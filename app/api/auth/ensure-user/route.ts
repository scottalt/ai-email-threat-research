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

    // Try to create the user (needed so signInWithOtp sends a code, not a link).
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (error) {
      // createUser errored. Could be "already registered" or "database error".
      // Either way the user might exist in auth. Check the error message:
      const msg = error.message.toLowerCase();
      const definitelyExists = msg.includes('already been registered')
        || msg.includes('already exists')
        || msg.includes('duplicate');

      if (definitelyExists) {
        return NextResponse.json({ ok: true, existing: true });
      }

      // Ambiguous error (e.g. "Database error"). We don't know if user is new or existing.
      // Return existing: null so the client can decide.
      console.log(`[ensure-user] ambiguous createUser error: ${error.message}`);
      return NextResponse.json({ ok: true, existing: null });
    }

    // createUser succeeded. Check if this user has a player profile (completed onboarding).
    if (created?.user?.id) {
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_id', created.user.id)
        .maybeSingle();

      return NextResponse.json({ ok: true, existing: !!player });
    }

    return NextResponse.json({ ok: true, existing: false });
  } catch (err) {
    console.error('[ensure-user] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
