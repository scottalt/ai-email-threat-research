import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'scott@scottaltiparmak.com';

async function getAuthUser() {
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
  return user;
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Gather player info for the email
  const { data: player } = await admin
    .from('players')
    .select('id, display_name, xp, level, total_sessions')
    .eq('id', user.id)
    .single();

  const { count: answerCount } = await admin
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', user.id);

  const { count: researchCount } = await admin
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', user.id)
    .eq('game_mode', 'research');

  const displayName = player?.display_name ?? 'Unknown';
  const authEmail = user.email ?? 'No email on file';

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'Threat Terminal <noreply@scottaltiparmak.com>',
    to: ADMIN_EMAIL,
    subject: `[Data Deletion Request] ${displayName}`,
    text: [
      'DATA DELETION REQUEST',
      '=====================',
      '',
      `Player:     ${displayName}`,
      `Auth email: ${authEmail}`,
      `Player ID:  ${user.id}`,
      '',
      'Stats:',
      `  Level:             ${player?.level ?? '?'}`,
      `  XP:                ${player?.xp ?? '?'}`,
      `  Total sessions:    ${player?.total_sessions ?? '?'}`,
      `  Total answers:     ${answerCount ?? '?'}`,
      `  Research answers:  ${researchCount ?? '?'}`,
      '',
      'Options:',
      '  1. Delete account only (keep anonymized research answers)',
      '  2. Full deletion (account + all answers including research)',
      '',
      'Reply to the player at their auth email, or handle directly in Supabase.',
    ].join('\n'),
  });

  if (error) {
    console.error('Failed to send deletion request email:', error);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
