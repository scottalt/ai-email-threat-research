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
    // Rate limit: 50 requests per IP per hour.
    // If exceeded, skip createUser but still check existing status (terms must always work).
    const ip = getClientIp(req);
    const rlKey = `ratelimit:ensure-user:${ip}`;
    const rlCount = await redis.incr(rlKey);
    if (rlCount === 1) await redis.expire(rlKey, 60 * 60);
    const rateLimited = rlCount > 50;

    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Try to create the user (needed so signInWithOtp sends a code, not a link).
    // Skip if rate limited — OTP still works, just might send a link instead of code for new users.
    let userId: string | null = null;
    let createErrored = false;

    if (!rateLimited) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (error) {
        createErrored = true;
      } else {
        userId = created?.user?.id ?? null;
      }
    }

    // If createUser errored, user likely exists
    if (createErrored) {
      return NextResponse.json({ ok: true, existing: true });
    }

    // Check player profile to determine new vs existing
    if (userId) {
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_id', userId)
        .maybeSingle();
      return NextResponse.json({ ok: true, existing: !!player });
    }

    // Rate limited or no userId — check if terms were agreed before via localStorage
    // (client-side fallback). Return existing: false so new users always see terms.
    return NextResponse.json({ ok: true, existing: false });
  } catch (err) {
    console.error('[ensure-user] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
