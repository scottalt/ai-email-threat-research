import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 per IP per minute
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rlKey = `ratelimit:create-handoff:${ip}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 60);
    if (count > 5) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });

    const { access_token, refresh_token } = await req.json();
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    // Validate token server-side and get user
    const admin = getSupabaseAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(access_token);
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Upsert player record (covers first sign-in via magic link)
    await admin.from('players').upsert(
      { auth_id: user.id },
      { onConflict: 'auth_id', ignoreDuplicates: true }
    );

    // Generate handoff code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await redis.set(
      `auth:handoff:${code}`,
      JSON.stringify({ access_token, refresh_token }),
      { ex: 300 }
    );

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
