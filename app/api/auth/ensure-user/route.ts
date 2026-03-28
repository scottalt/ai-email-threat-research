import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pre-creates a user via the admin API so that subsequent signInWithOtp()
 * calls always treat them as an existing user and send a 6-digit code
 * instead of a confirmation link (Supabase's default for new signups).
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests per IP per hour
    const ip = getClientIp(req);
    const rlKey = `ratelimit:ensure-user:${ip}`;
    const rlCount = await redis.incr(rlKey);
    if (rlCount === 1) await redis.expire(rlKey, 60 * 60);
    if (rlCount > 10) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Try to create the auth user. If they exist, this errors.
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const alreadyInAuth = msg.includes('already been registered')
        || msg.includes('already exists')
        || msg.includes('duplicate');
      if (alreadyInAuth) {
        return NextResponse.json({ ok: true, existing: true });
      }
      console.error('[ensure-user] createUser error:', error.message);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // createUser succeeded — check if it returned an existing user
    // (some Supabase versions don't error, they return the existing user)
    if (created?.user?.created_at) {
      const createdAt = new Date(created.user.created_at).getTime();
      const now = Date.now();
      // If the user was created more than 60s ago, they're existing
      if (now - createdAt > 60_000) {
        return NextResponse.json({ ok: true, existing: true });
      }
    }

    return NextResponse.json({ ok: true, existing: false });
  } catch (err) {
    console.error('[ensure-user] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
