import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { CURRENT_SEASON, H2H_CARDS_PER_MATCH, H2H_MATCH_TTL, H2H_RANKS, getRankFromPoints } from '@/lib/h2h';

// POST /api/h2h/queue/bot — Create a bot match directly (called by client after queue timeout)

async function getAuthPlayerId(): Promise<{ id: string; research_graduated: boolean } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin
    .from('players')
    .select('id, research_graduated')
    .eq('auth_id', user.id)
    .single();

  return player ?? null;
}

export async function POST() {
  const player = await getAuthPlayerId();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!player.research_graduated) {
    return NextResponse.json({ error: 'Complete research to unlock PvP' }, { status: 403 });
  }
  const playerId = player.id as string;

  // Enforce minimum queue wait time server-side (prevents bypassing the 30s client timer)
  const queueJoinKey = `h2h:queue-joined:${playerId}`;
  const joinedAt = await redis.get<number>(queueJoinKey);
  if (!joinedAt) {
    // Must join queue first — prevents direct bot endpoint calls
    return NextResponse.json({ error: 'Must join queue first' }, { status: 429 });
  }
  const waitedMs = Date.now() - joinedAt;
  if (waitedMs < 25_000) { // 25s (slightly less than client 30s to account for network latency)
    return NextResponse.json({ error: 'Queue timeout not reached' }, { status: 429 });
  }

  // Prevent creating multiple bot matches concurrently
  // Short lock (30s) — released on match end, expires naturally if client fails to release
  const lockKey = `h2h:bot-lock:${playerId}`;
  const acquired = await redis.set(lockKey, '1', { ex: 30, nx: true });
  if (!acquired) {
    console.log(`[bot] lock blocked for ${playerId.slice(0,8)}`);
    return NextResponse.json({ error: 'Bot match already in progress' }, { status: 409 });
  }

  const admin = getSupabaseAdminClient();

  // Cancel any stale active matches before checking
  // Bot matches: 90 seconds (they never last longer than ~60s)
  // Real matches: 10 minutes
  const botStale = new Date(Date.now() - 90 * 1000).toISOString();
  const realStale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await admin.from('h2h_matches')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('status', 'active')
    .eq('is_ghost_match', true)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .lt('started_at', botStale);
  await admin.from('h2h_matches')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('status', 'active')
    .eq('is_ghost_match', false)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .lt('started_at', realStale);

  // Check no active match already (recent ones only, stale ones just cleaned)
  const { data: activeMatch } = await admin
    .from('h2h_matches')
    .select('id')
    .eq('status', 'active')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .limit(1)
    .maybeSingle();

  if (activeMatch) {
    console.log(`[bot] active match blocked for ${playerId.slice(0,8)}: ${activeMatch.id}`);
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Already in an active match' }, { status: 409 });
  }
  console.log(`[bot] creating match for ${playerId.slice(0,8)}`);

  // Pick a persistent bot player if feature flag is enabled
  let botPlayerId: string | null = null;
  if (process.env.H2H_PERSISTENT_BOTS === 'true') {
    // Get the player's current rank points
    const { data: playerStats } = await admin
      .from('h2h_player_stats')
      .select('rank_points')
      .eq('player_id', playerId)
      .maybeSingle();
    const playerPoints = playerStats?.rank_points ?? 0;
    const playerRankIndex = H2H_RANKS.findIndex(
      (r) => r.tier === getRankFromPoints(playerPoints).tier
    );

    // Query all bot players with their stats
    const { data: botPlayers } = await admin
      .from('players')
      .select('id, bot_config, h2h_player_stats!left(rank_points, rated_matches_today, last_match_date)')
      .eq('is_bot', true);

    console.log(`[bot] persistent bot query returned ${botPlayers?.length ?? 0} bots`);
    if (botPlayers && botPlayers.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const eligibleBots = botPlayers.filter((bot) => {
        const stats = Array.isArray(bot.h2h_player_stats)
          ? bot.h2h_player_stats[0]
          : bot.h2h_player_stats;
        if (!stats) return true; // no stats yet — under cap
        const isToday = String(stats.last_match_date ?? '').slice(0, 10) === todayStr;
        const matchesToday = isToday ? (stats.rated_matches_today ?? 0) : 0;
        return matchesToday < 20;
      });

      if (eligibleBots.length > 0) {
        // Group by tier proximity, then pick randomly within the closest group
        const withDiff = eligibleBots.map((bot) => {
          const statsBot = Array.isArray(bot.h2h_player_stats) ? bot.h2h_player_stats[0] : bot.h2h_player_stats;
          const botPoints = statsBot?.rank_points ?? 0;
          const botRankIdx = H2H_RANKS.findIndex((r) => r.tier === getRankFromPoints(botPoints).tier);
          return { bot, tierDiff: Math.abs(botRankIdx - playerRankIndex) };
        });
        const minDiff = Math.min(...withDiff.map((b) => b.tierDiff));
        const closestBots = withDiff.filter((b) => b.tierDiff === minDiff);
        const picked = closestBots[Math.floor(Math.random() * closestBots.length)];
        botPlayerId = picked.bot.id as string;
        console.log(`[bot] selected persistent bot ${botPlayerId.slice(0,8)} for ${playerId.slice(0,8)}`);
      } else {
        console.log(`[bot] no eligible persistent bots — falling back to ghost match`);
      }
    }
  }

  // Create bot match
  const { data: match, error } = await admin
    .from('h2h_matches')
    .insert({
      season: CURRENT_SEASON,
      player1_id: playerId,
      player2_id: botPlayerId,
      card_ids: [],
      status: 'active',
      is_ghost_match: botPlayerId === null,
      is_rated: true,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !match) {
    await redis.del(lockKey);
    console.error('[h2h:bot] Failed to create bot match:', error?.message);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }

  // Deal cards
  const { data: cardData } = await admin
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert'])
    .limit(500);

  if (!cardData || cardData.length < H2H_CARDS_PER_MATCH) {
    // Cancel the zombie match row before releasing lock
    await admin.from('h2h_matches')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', match.id);
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Not enough cards' }, { status: 500 });
  }

  const arr = [...cardData];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const deck = arr.slice(0, H2H_CARDS_PER_MATCH);

  const cards = deck.map((row) => ({
    id: row.card_id,
    type: row.type,
    isPhishing: row.is_phishing,
    difficulty: row.difficulty ?? 'medium',
    from: row.from_address,
    subject: row.subject ?? undefined,
    body: row.body,
    clues: row.clues ?? [],
    explanation: row.explanation ?? '',
    highlights: row.highlights ?? [],
    technique: row.technique,
    authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
    attachmentName: row.attachment_name ?? undefined,
  }));

  await redis.set(`match-cards:${match.id}`, JSON.stringify(cards), { ex: H2H_MATCH_TTL });
  await redis.set(`match-render:${match.id}:${playerId}:0`, Date.now(), { ex: H2H_MATCH_TTL });
  if (botPlayerId) {
    await redis.set(`match-render:${match.id}:${botPlayerId}:0`, Date.now(), { ex: H2H_MATCH_TTL });
  }
  await admin.from('h2h_matches').update({ card_ids: cards.map((c) => c.id) }).eq('id', match.id);

  console.log(`[bot] match created for ${playerId.slice(0,8)}: ${match.id}`);
  return NextResponse.json({ matchId: match.id });
}
