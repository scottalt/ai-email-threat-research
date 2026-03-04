import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { PlayerBackground, PlayerProfile } from '@/lib/types';

const VALID_BACKGROUNDS: PlayerBackground[] = ['other', 'technical', 'infosec', 'prefer_not_to_say'];

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function toProfile(row: Record<string, unknown>): PlayerProfile {
  return {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
    background: (row.background as PlayerBackground | null) ?? null,
  };
}

// GET /api/player — returns the signed-in player's profile
export async function GET(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  return NextResponse.json(toProfile(data as unknown as Record<string, unknown>), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST /api/player — update display_name and/or background
export async function POST(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('displayName' in body) {
    const displayName = typeof body.displayName === 'string'
      ? body.displayName.trim().slice(0, 20)
      : null;
    if (!displayName) return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 });
    updates.display_name = displayName;
  }

  if ('background' in body) {
    updates.background = VALID_BACKGROUNDS.includes(body.background) ? body.background as PlayerBackground : null;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .update(updates)
    .eq('auth_id', authId)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(toProfile(data as unknown as Record<string, unknown>));
}
