import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const expand = req.nextUrl.searchParams.get('expand') === '1';
  const limit = expand ? 50 : 10;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('display_name, xp, level, research_graduated, theme_id')
    .gte('xp', 0)
    .order('xp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('XP leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
