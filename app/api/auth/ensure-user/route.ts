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

    // Step 1: Try createUser. For genuinely new emails this is fast.
    // For existing emails, Supabase either errors or returns the existing user.
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    // Case A: Supabase errored — user exists
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('duplicate')) {
        return NextResponse.json({ ok: true, existing: true });
      }
      console.error('[ensure-user] createUser error:', error.message);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Case B: createUser "succeeded" — but did it create a new user or return an existing one?
    // Check if this auth user already has a player profile (terms were agreed previously)
    if (created?.user?.id) {
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .select('id')
        .eq('auth_id', created.user.id)
        .maybeSingle();

      console.log(`[ensure-user] createUser succeeded for ${email}: auth_id=${created.user.id}, player=${player?.id ?? 'null'}, playerErr=${playerErr?.message ?? 'none'}, created_at=${created.user.created_at}`);

      if (player) {
        return NextResponse.json({ ok: true, existing: true });
      }
    } else {
      console.log(`[ensure-user] createUser returned no user for ${email}`);
    }

    // Case C: Genuinely new user
    return NextResponse.json({ ok: true, existing: false });
  } catch (err) {
    console.error('[ensure-user] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
