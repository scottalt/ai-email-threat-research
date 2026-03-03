import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

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
    const level = parts.length >= 3 ? parseInt(parts[parts.length - 2], 10) || 1 : 1;
    const name = parts.length >= 3 ? parts.slice(0, parts.length - 2).join(':') : parts[0];
    entries.push({ name, score, level });
  }

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  try {
    const { name, score, date, level } = await req.json();
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

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const safeLevel = typeof level === 'number' && level >= 1 && level <= 30 ? level : 1;
    const member = `${trimmed}:${safeLevel}:${Date.now()}`;
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
