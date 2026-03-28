import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

async function getPlayerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from('players').select('id').eq('auth_id', user.id).single();
  return data?.id ?? null;
}

// GET /api/player/messages — get unseen messages for the current player
export async function GET() {
  const playerId = await getPlayerId();
  if (!playerId) return NextResponse.json({ messages: [] });

  const admin = getSupabaseAdminClient();

  // Get all messages targeting this player OR global (no target)
  // that haven't been seen yet and haven't expired
  const { data: messages, error } = await admin
    .from('admin_messages')
    .select('id, lines, button_text, target_player_id, created_at, expires_at, achievement_id, theme_id')
    .or(`target_player_id.eq.${playerId},target_player_id.is.null`)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ messages: [] });

  // Filter out expired and already-seen messages
  const now = new Date();
  const { data: seenRows } = await admin
    .from('admin_message_seen')
    .select('message_id')
    .eq('player_id', playerId);
  const seenIds = new Set((seenRows ?? []).map((r: { message_id: string }) => r.message_id));

  const unseen = (messages ?? []).filter((m) => {
    if (seenIds.has(m.id)) return false;
    if (m.expires_at && new Date(m.expires_at) < now) return false;
    return true;
  }).map((m) => ({
    id: m.id,
    lines: m.lines,
    buttonText: m.button_text,
    isGlobal: !m.target_player_id,
    achievementId: m.achievement_id ?? null,
    themeId: m.theme_id ?? null,
    createdAt: m.created_at,
  }));

  return NextResponse.json({ messages: unseen });
}

// POST /api/player/messages — mark a message as seen
export async function POST(req: Request) {
  const playerId = await getPlayerId();
  if (!playerId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { messageId, grantAchievement, unlockTheme } = await req.json();
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  await admin.from('admin_message_seen').upsert(
    { message_id: messageId, player_id: playerId },
    { onConflict: 'message_id,player_id' },
  );

  // Grant achievement if the message includes one
  if (grantAchievement && typeof grantAchievement === 'string') {
    // Verify the message actually has this achievement (prevent spoofing)
    const { data: msg } = await admin.from('admin_messages').select('achievement_id').eq('id', messageId).single();
    if (msg?.achievement_id === grantAchievement) {
      await admin.from('player_achievements').upsert(
        { player_id: playerId, achievement_id: grantAchievement, unlocked_at: new Date().toISOString() },
        { onConflict: 'player_id,achievement_id' },
      );
    }
  }

  // Unlock theme if the message includes one
  if (unlockTheme && typeof unlockTheme === 'string') {
    const { data: msg2 } = await admin.from('admin_messages').select('theme_id').eq('id', messageId).single();
    if (msg2?.theme_id === unlockTheme) {
      const { data: p } = await admin.from('players').select('unlocked_themes').eq('id', playerId).single();
      const current = (p?.unlocked_themes as string[]) ?? [];
      if (!current.includes(unlockTheme)) {
        await admin.from('players').update({ unlocked_themes: [...current, unlockTheme] }).eq('id', playerId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
