import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Valid moment IDs — prevent arbitrary strings from being stored
const VALID_MOMENTS = new Set([
  'boot_greeting', 'v2_intro', 'research_brief', 'tutorial_intro',
  'tutorial_complete', 'first_research_start', 'first_correct',
  'pvp_unlock', 'daily_unlock', 'freeplay_unlock', 'first_pvp_win',
  'first_pvp_open', 'first_inventory', 'first_profile', 'first_shop',
  'first_pvp_loss', 'win_streak_3', 'win_streak_5',
  'first_elimination', 'perfect_match', 'research_halfway',
  'first_session_complete', 'first_daily', 'first_friend',
  'level_10', 'level_20', 'played_7_days',
]);

// PATCH /api/player/moments — mark a moment as seen
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const momentId = typeof body.momentId === 'string' ? body.momentId : null;
  if (!momentId || !VALID_MOMENTS.has(momentId)) {
    return NextResponse.json({ error: 'Invalid moment ID' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Upsert — ignore if already exists (unique constraint on player_id + moment_id)
  await admin
    .from('player_seen_moments')
    .upsert(
      { player_id: player.id, moment_id: momentId },
      { onConflict: 'player_id,moment_id', ignoreDuplicates: true }
    );

  return NextResponse.json({ ok: true });
}
