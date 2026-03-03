import { createHmac, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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
