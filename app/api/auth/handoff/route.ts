import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const CODE_RE = /^[A-Z2-9]{6}$/;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 attempts per IP per 5 minutes
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rlKey = `ratelimit:handoff:${ip}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 5 * 60);
    if (count > 10) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });

    const { code } = await req.json();
    if (typeof code !== 'string' || !CODE_RE.test(code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Atomic get+delete — code is single-use
    const raw = await redis.getdel(`auth:handoff:${code}`);
    if (!raw) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });

    const { access_token, refresh_token } = JSON.parse(raw as string);
    return NextResponse.json({ access_token, refresh_token });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
