import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { THEMES } from '@/lib/themes';

/**
 * PATCH /api/player/theme
 * Save the player's selected theme server-side.
 * Body: { themeId: string }
 */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const themeId = body?.themeId;

  if (typeof themeId !== 'string' || !THEMES.some((t) => t.id === themeId)) {
    return NextResponse.json({ error: 'Invalid themeId' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await admin.from('players').update({
    theme_id: themeId,
    updated_at: new Date().toISOString(),
  }).eq('auth_id', user.id);

  return NextResponse.json({ ok: true });
}
