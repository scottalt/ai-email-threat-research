import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('display_name, xp, level, research_graduated')
    .order('xp', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
