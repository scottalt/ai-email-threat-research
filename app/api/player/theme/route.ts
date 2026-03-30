import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { THEMES, isThemeUnlocked } from '@/lib/themes';

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

  const theme = THEMES.find((t) => t.id === themeId);
  if (typeof themeId !== 'string' || !theme) {
    return NextResponse.json({ error: 'Invalid themeId' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Server-side unlock check — prevent equipping themes the player hasn't earned
  const { data: player } = await admin
    .from('players')
    .select('level, research_graduated, theme_id, unlocked_themes')
    .eq('auth_id', user.id)
    .single();

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (!isThemeUnlocked(theme, player.level ?? 1, player.research_graduated ?? false, player.theme_id as string, (player.unlocked_themes as string[]) ?? [])) {
    return NextResponse.json({ error: 'Theme not unlocked' }, { status: 403 });
  }

  await admin.from('players').update({
    theme_id: themeId,
    updated_at: new Date().toISOString(),
  }).eq('auth_id', user.id);

  return NextResponse.json({ ok: true });
}
