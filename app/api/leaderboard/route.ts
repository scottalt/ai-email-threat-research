import { NextRequest, NextResponse } from 'next/server';
import { redis, getClientIp } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { THEMES } from '@/lib/themes';
import filter from 'leo-profanity';

const KEY = 'leaderboard';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Mirror of client scoring constants — used to verify submitted scores
const BASE_POINTS = 100;
const CONFIDENCE_MULTIPLIER: Record<string, number> = { guessing: 1, likely: 2, certain: 3 };
const CONFIDENCE_PENALTY: Record<string, number> = { guessing: 0, likely: -100, certain: -200 };
const STREAK_BONUS = 50;

const BLOCKED_NAMES = ['dailytester', 'testuser', 'test'];

function isAllowed(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return !BLOCKED_NAMES.includes(lower);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (date && !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const expand = searchParams.get('expand') === '1';
  const limit = expand ? 49 : 19; // 0-indexed: 19 = top 20, 49 = top 50
  const key = date ? `leaderboard:daily:${date}` : KEY;

  const results = await redis.zrange(key, 0, limit, {
    rev: true,
    withScores: true,
  }) as (string | number)[];

  const entries: { name: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const member = results[i] as string;
    const score = results[i + 1] as number;
    // Daily keys now use plain display_name as member.
    // Legacy entries may still have ":level" suffix — strip it for dedup.
    let name: string;
    if (date) {
      // For daily leaderboard, member is just the display name (no level suffix).
      // Handle legacy entries that still have :level by stripping trailing :number.
      const legacyMatch = member.match(/^(.+):(\d+)$/);
      if (legacyMatch && parseInt(legacyMatch[2], 10) >= 1 && parseInt(legacyMatch[2], 10) <= 30) {
        name = legacyMatch[1];
      } else {
        name = member;
      }
    } else {
      // Global leaderboard still uses name:level format
      const parts = member.split(':');
      if (parts.length >= 3) {
        name = parts.slice(0, parts.length - 2).join(':');
      } else if (parts.length === 2) {
        name = parts.slice(0, -1).join(':');
      } else {
        name = member;
      }
    }
    entries.push({ name, score });
  }

  // Deduplicate: if legacy :level entries coexist with new plain entries, keep best score
  const bestByName = new Map<string, { name: string; score: number }>();
  for (const e of entries) {
    const existing = bestByName.get(e.name);
    if (!existing || e.score > existing.score) {
      bestByName.set(e.name, e);
    }
  }
  const dedupedEntries = [...bestByName.values()].sort((a, b) => b.score - a.score);

  // Look up player info (level + theme) from DB
  const names = dedupedEntries.map((e) => e.name);
  const supabase = getSupabaseAdminClient();
  const { data: playerInfo } = await supabase
    .from('players')
    .select('display_name, level, theme_id')
    .in('display_name', names);

  const playerMap: Record<string, { level: number; nameEffect: string | null; color: string }> = {};
  for (const p of playerInfo ?? []) {
    const theme = THEMES.find((t) => t.id === (p.theme_id ?? 'phosphor'));
    playerMap[p.display_name] = {
      level: p.level ?? 1,
      nameEffect: theme?.nameEffect ?? null,
      color: theme?.colors.primary ?? '#00ff41',
    };
  }

  return NextResponse.json(dedupedEntries.map((e) => ({
    ...e,
    level: playerMap[e.name]?.level ?? 1,
    nameEffect: playerMap[e.name]?.nameEffect ?? null,
    themeColor: playerMap[e.name]?.color ?? null,
  })));
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 submissions per IP per hour
    const ip = getClientIp(req);
    const rlKey = `ratelimit:leaderboard:${ip}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 60 * 60);
    if (count > 10) {
      return NextResponse.json({ error: 'Too many submissions.' }, { status: 429 });
    }

    const { name, score, date, level, sessionId } = await req.json();

    // Require a sessionId and verify it against the sessions table + answers
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient();
    const [{ data: session }, { data: answers }] = await Promise.all([
      supabase
        .from('sessions')
        .select('session_id, completed_at')
        .eq('session_id', sessionId)
        .eq('final_score', score)
        .single(),
      supabase
        .from('answers')
        .select('correct, confidence, streak_at_answer_time')
        .eq('session_id', sessionId),
    ]);
    // Session must exist with matching score, be completed, and have actual answers
    if (!session || !session.completed_at || !answers || answers.length < 1) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // Recompute score server-side from actual answers to prevent client manipulation
    let computedScore = 0;
    for (const a of answers) {
      if (a.correct) {
        const mult = CONFIDENCE_MULTIPLIER[a.confidence] ?? 1;
        computedScore += BASE_POINTS * mult;
        // Streak bonus every 3 consecutive correct (streak_at_answer_time is the streak BEFORE this answer)
        const streakAfter = (a.streak_at_answer_time ?? 0) + 1;
        if (streakAfter > 0 && streakAfter % 3 === 0) computedScore += STREAK_BONUS;
      } else {
        computedScore += CONFIDENCE_PENALTY[a.confidence] ?? 0;
      }
    }
    // Allow minimal tolerance for rounding edge cases, but catch manipulation
    if (Math.abs(computedScore - score) > 10) {
      return NextResponse.json({ error: 'Score mismatch' }, { status: 400 });
    }

    // One leaderboard entry per session — prevent multiple name submissions for same score
    const dedupKey = `lb:submitted:${sessionId}`;
    const claimed = await redis.set(dedupKey, '1', { nx: true, ex: 90 * 24 * 60 * 60 });
    if (!claimed) {
      return NextResponse.json({ ok: true }); // Already submitted — silently skip
    }
    if (date && (typeof date !== 'string' || !DATE_RE.test(date))) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const key = date ? `leaderboard:daily:${date}` : KEY;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const trimmed = name.trim().slice(0, 20);

    if (trimmed.length < 1) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    if (filter.check(trimmed)) {
      return NextResponse.json({ error: 'Keep it clean.' }, { status: 400 });
    }

    if (!isAllowed(trimmed)) {
      return NextResponse.json({ error: 'Name not allowed.' }, { status: 400 });
    }

    const MAX_SCORE = 3500; // above theoretical max of ~3150 (10 CERTAIN correct + 3 streak bonuses)
    if (typeof score !== 'number' || score < 0 || score > MAX_SCORE || !Number.isFinite(score)) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const safeLevel = typeof level === 'number' && level >= 1 && level <= 30 ? level : 1;
    // Daily leaderboard: use plain name so level-ups don't create duplicate entries.
    // Global leaderboard: keep name:level for backwards compat.
    const member = date ? trimmed : `${trimmed}:${safeLevel}`;

    // Only write if this beats the existing score for this player
    const existing = await redis.zscore(key, member);
    if (existing !== null && (existing as number) >= score) {
      return NextResponse.json({ ok: true });
    }
    await redis.zadd(key, { score, member });

    if (date) {
      const expireAt = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) + 7 * 24 * 60 * 60;
      await redis.expireat(key, expireAt);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
