import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY!;

// Auth client — used for admin auth ops (verifyOtp taints the session, so keep it separate)
const authAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Data client — always uses service_role key, never tainted by user sessions
const dataAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const TEST_FRESH_EMAIL = 'test-fresh@phish-or-not.dev';
export const TEST_GRADUATED_EMAIL = 'test-graduated@phish-or-not.dev';
export const TEST_FREEPLAY_EMAIL = 'test-freeplay@phish-or-not.dev';

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Ensure a test user exists in Supabase Auth and return session tokens.
 * Uses admin API — no OTP needed.
 */
export async function ensureTestUser(email: string): Promise<TestUser> {
  // Try to find existing user
  const { data: { users } } = await authAdmin.auth.admin.listUsers();
  let user = users.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`);
    user = data.user;
  }

  // Generate a session for this user
  const { data: linkData, error: sessionErr } = await authAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (sessionErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Failed to generate session for ${email}: ${sessionErr?.message ?? 'no hashed_token returned'}`);
  }

  // Exchange the link token for a session (use authAdmin — this taints the client's session)
  const { data: tokenData, error: tokenErr } = await authAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (tokenErr || !tokenData?.session) {
    throw new Error(`Failed to verify token for ${email}: ${tokenErr?.message ?? 'no session returned'}`);
  }

  return {
    id: user.id,
    email,
    accessToken: tokenData.session.access_token,
    refreshToken: tokenData.session.refresh_token,
  };
}

/**
 * Ensure the test user has a player row with a display name.
 * Required so the inline callsign gate doesn't block game start.
 */
export async function ensurePlayerProfile(authId: string, displayName = 'TEST_PLAYER'): Promise<void> {
  const { data: player } = await dataAdmin
    .from('players')
    .select('id, display_name')
    .eq('auth_id', authId)
    .single();

  if (!player) {
    await dataAdmin.from('players').insert({ auth_id: authId, display_name: displayName, background: 'technical' });
  } else if (!player.display_name) {
    await dataAdmin.from('players').update({ display_name: displayName, background: 'technical' }).eq('id', player.id);
  }
}

/**
 * Set up the graduated test user with 30 research answers and graduated flag.
 * Idempotent — safe to call multiple times.
 */
export async function seedGraduatedUser(authId: string): Promise<void> {
  const { data: player } = await dataAdmin
    .from('players')
    .select('id, research_graduated, display_name')
    .eq('auth_id', authId)
    .single();

  let playerId: string;

  if (!player) {
    const { data: newPlayer, error } = await dataAdmin
      .from('players')
      .insert({ auth_id: authId, display_name: 'TEST_GRADUATED', background: 'technical', research_graduated: true, xp: 3000, level: 5 })
      .select('id')
      .single();
    if (error) throw new Error(`Failed to create player: ${error.message}`);
    playerId = newPlayer.id;
  } else {
    playerId = player.id;
    const updates: Record<string, unknown> = {};
    if (!player.research_graduated) updates.research_graduated = true;
    if (!(player as { display_name?: string }).display_name) {
      updates.display_name = 'TEST_GRADUATED';
      updates.background = 'technical';
    }
    if (Object.keys(updates).length > 0) {
      await dataAdmin.from('players').update(updates).eq('id', playerId);
    }
  }

  // Check if already has 30+ research answers
  const { count } = await dataAdmin
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('game_mode', 'research');

  if ((count ?? 0) >= 30) return;

  // Get card IDs not already answered by this player (avoids dedup constraint)
  const { data: existingAnswers } = await dataAdmin
    .from('answers')
    .select('card_id')
    .eq('player_id', playerId)
    .eq('game_mode', 'research');

  const answeredCardIds = new Set((existingAnswers ?? []).map((a) => a.card_id));
  const needed = 30 - (count ?? 0);

  const { data: cards } = await dataAdmin
    .from('cards_real')
    .select('card_id, is_phishing, difficulty, type, technique')
    .limit(needed + 10);

  if (!cards) throw new Error('Failed to fetch cards for seeding');

  const availableCards = cards.filter((c) => !answeredCardIds.has(c.card_id));
  if (availableCards.length < needed) {
    throw new Error(`Need ${needed} unanswered cards, found ${availableCards.length}`);
  }

  const sessionId = crypto.randomUUID();
  await dataAdmin.from('sessions').insert({
    session_id: sessionId,
    game_mode: 'research',
    cards_answered: needed,
    completed_at: new Date().toISOString(),
  });

  const answers = availableCards.slice(0, needed).map((card, i) => ({
    session_id: sessionId,
    player_id: playerId,
    card_id: card.card_id,
    card_source: 'real' as const,
    is_phishing: card.is_phishing,
    technique: card.technique,
    difficulty: card.difficulty,
    type: card.type,
    user_answer: card.is_phishing ? 'phishing' : 'legit',
    correct: true,
    confidence: 'certain' as const,
    game_mode: 'research' as const,
    answer_ordinal: (i % 10) + 1,
  }));

  const { error: insertErr } = await dataAdmin.from('answers').insert(answers);
  if (insertErr) throw new Error(`Failed to seed answers: ${insertErr.message}`);
}
