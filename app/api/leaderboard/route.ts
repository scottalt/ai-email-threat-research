import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const KEY = 'leaderboard';

const BAD_WORDS = [
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'fag', 'retard',
  'bitch', 'ass', 'cock', 'dick', 'pussy', 'whore', 'slut', 'bastard',
];

function isClean(name: string): boolean {
  const lower = name.toLowerCase().replace(/\s+/g, '');
  return !BAD_WORDS.some((w) => lower.includes(w));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const key = date ? `leaderboard:daily:${date}` : KEY;

  const results = await redis.zrange(key, 0, 19, {
    rev: true,
    withScores: true,
  }) as (string | number)[];

  const entries: { name: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const member = results[i] as string;
    const score = results[i + 1] as number;
    entries.push({ name: member.split(':')[0], score });
  }

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  try {
    const { name, score, date } = await req.json();
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

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const member = `${trimmed}:${Date.now()}`;
    await redis.zadd(key, { score, member });

    if (date) {
      await redis.expire(key, 60 * 60 * 24 * 7);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
