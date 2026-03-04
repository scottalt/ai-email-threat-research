import { createHmac, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:admin-login:${ip}`;
  const attempts = await redis.incr(rlKey);
  if (attempts === 1) await redis.expire(rlKey, 15 * 60);
  if (attempts > 5) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { password } = await req.json();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  // Generate a stateless opaque token: nonce.HMAC(nonce, password)
  // The cookie never contains the password itself.
  const nonce = randomBytes(16).toString('hex');
  const hmac = createHmac('sha256', expected).update(nonce).digest('hex');
  const sessionToken = `${nonce}.${hmac}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
  return res;
}
