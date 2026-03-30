import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET /api/roguelike/history — Return the player's last 20 completed/abandoned runs
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = getSupabaseAdminClient();

    // Look up player id from auth id
    const { data: player } = await admin
      .from('players')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const playerId = player.id;

    const { data: runs } = await admin
      .from('roguelike_runs')
      .select('id, operation_name, score, floor_reached, floors_cleared, deaths, best_streak, cards_answered, cards_correct, clearance_earned, status, started_at, ended_at')
      .eq('player_id', playerId)
      .in('status', ['complete', 'abandoned'])
      .order('ended_at', { ascending: false })
      .limit(20);

    const mapped = (runs ?? []).map((r) => ({
      id: r.id,
      operationName: r.operation_name,
      score: r.score,
      floorReached: r.floor_reached,
      floorsCleared: r.floors_cleared,
      deaths: r.deaths,
      bestStreak: r.best_streak,
      cardsAnswered: r.cards_answered,
      cardsCorrect: r.cards_correct,
      clearanceEarned: r.clearance_earned,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
    }));

    return NextResponse.json({ runs: mapped });
  } catch (err) {
    console.error('[roguelike/history] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
