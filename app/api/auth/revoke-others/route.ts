import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

// POST /api/auth/revoke-others — Sign out all other sessions for the current user.
// Called after successful OTP verification to enforce single-device sessions.

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: true }); // not signed in — nothing to revoke
    }

    // Use admin client to revoke all OTHER sessions for this user
    const admin = getSupabaseAdminClient();
    await admin.auth.admin.signOut(user.id, 'others');

    return NextResponse.json({ ok: true });
  } catch {
    // Non-fatal — if revocation fails, the user still signed in successfully
    return NextResponse.json({ ok: true });
  }
}
