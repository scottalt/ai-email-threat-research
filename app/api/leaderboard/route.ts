import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';

const KEY = 'leaderboard';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BAD_WORDS = [
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'fag', 'retard',
  'bitch', 'ass', 'cock', 'dick', 'pussy', 'whore', 'slut', 'bastard',
];

const BLOCKED_NAMES = ['dailytester', 'testuser', 'test'];

function isClean(name: string): boolean {
  const lower = name.toLowerCase().replace(/\s+/g, '');
  return !BAD_WORDS.some((w) => lower.includes(w));
}

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
  const key = date ? `leaderboard:daily:${date}` : KEY;

  const results = await redis.zrange(key, 0, 19, {
    rev: true,
    withScores: true,
  }) as (string | number)[];

  const entries: { name: string; score: number; level: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const member = results[i] as string;
    const score = results[i + 1] as number;
    const parts = member.split(':');
    let name: string;
    let level: number;
    if (parts.length >= 3) {
      // Legacy format: name:level:timestamp
      level = parseInt(parts[parts.length - 2], 10) || 1;
      name = parts.slice(0, parts.length - 2).join(':');
    } else if (parts.length === 2) {
      // Current format: name:level
      const maybeLevel = parseInt(parts[parts.length - 1], 10);
      level = maybeLevel >= 1 && maybeLevel <= 30 ? maybeLevel : 1;
      name = parts.slice(0, -1).join(':');
    } else {
      level = 1;
      name = member;
    }
    entries.push({ name, score, level });
  }

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 submissions per IP per hour
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rlKey = `ratelimit:leaderboard:${ip}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 60 * 60);
    if (count > 10) {
      return NextResponse.json({ error: 'Too many submissions.' }, { status: 429 });
    }

    const { name, score, date, level, sessionId } = await req.json();

    // Require a sessionId and verify it against the sessions table
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient();
    const { data: session } = await supabase
      .from('sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('final_score', score)
      .single();
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
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

    if (!isClean(trimmed)) {
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
    const member = `${trimmed}:${safeLevel}`;

    // Only write if this beats the existing score for this name+level
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
