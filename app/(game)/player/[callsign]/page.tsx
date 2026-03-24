import { getSupabaseAdminClient } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ACHIEVEMENTS, RARITY_COLORS, CATEGORY_LABELS, type AchievementCategory } from '@/lib/achievements';
import { getRankFromPoints, CURRENT_SEASON } from '@/lib/h2h';
import { getRankFromLevel } from '@/lib/rank';
import Link from 'next/link';
import { AddFriendButton } from './AddFriendButton';

interface Props {
  params: Promise<{ callsign: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { callsign } = await params;
  const decodedCallsign = decodeURIComponent(callsign);

  const admin = getSupabaseAdminClient();

  // Look up player by display_name (case-insensitive)
  // Use limit(1) instead of maybeSingle() to avoid error when dupes exist (legacy data)
  const { data: players } = await admin
    .from('players')
    .select('id, display_name, bio, privacy_level, featured_badges, xp, level, total_sessions')
    .ilike('display_name', decodedCallsign)
    .order('xp', { ascending: false })
    .limit(1);

  const player = players?.[0] ?? null;

  if (!player) {
    return (
      <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="term-border bg-[var(--c-bg)] px-4 py-8 text-center space-y-3">
            <div className="text-[#ff3333] text-2xl font-mono font-bold tracking-widest">404</div>
            <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">PLAYER_NOT_FOUND</div>
            <div className="text-[var(--c-muted)] text-sm font-mono">No operator with that callsign exists.</div>
            <Link href="/" className="inline-block mt-4 text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-widest">
              &lt; RETURN_TO_BASE
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Identify viewer (for own-profile check and friends-only privacy)
  let isOwnProfile = false;
  let viewerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: viewer } = await admin.from('players').select('id').eq('auth_id', user.id).single();
      if (viewer) {
        viewerId = viewer.id;
        if (viewer.id === player.id) isOwnProfile = true;
      }
    }
  } catch { /* not signed in — that's fine */ }

  const privacyLevel = (player.privacy_level as string) ?? 'public';
  const playerId = player.id as string;

  // Privacy check — own profile always visible
  if (!isOwnProfile && (privacyLevel === 'private' || privacyLevel === 'friends')) {
    let isFriend = false;
    if (privacyLevel === 'friends' && viewerId) {
      const { data: friendship } = await admin
        .from('player_friends')
        .select('id')
        .eq('player_id', viewerId)
        .eq('friend_id', playerId)
        .eq('status', 'accepted')
        .maybeSingle();
      isFriend = !!friendship;
    }

    if (!isFriend) {
      return (
        <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
          <div className="w-full max-w-sm space-y-4">
            <div className="term-border bg-[var(--c-bg)] px-4 py-8 text-center space-y-3">
              <div className="text-[var(--c-primary)] text-lg font-mono font-bold tracking-widest">
                {player.display_name as string}
              </div>
              <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest mt-4">PROFILE_IS_PRIVATE</div>
              <div className="text-[var(--c-muted)] text-sm font-mono">
                {privacyLevel === 'friends' ? 'This operator\'s profile is visible to friends only.' : 'This operator\'s profile is not public.'}
              </div>
              <Link href="/" className="inline-block mt-4 text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-widest">
                &lt; RETURN_TO_BASE
              </Link>
            </div>
          </div>
        </main>
      );
    }
  }

  // Public profile — fetch all data
  const bio = (player.bio as string) ?? '';
  const featuredBadgeIds: string[] = (player.featured_badges as string[]) ?? [];
  const xp = player.xp as number;
  const level = player.level as number;
  const displayName = player.display_name as string;

  const [{ data: achievementRows }, { data: h2hStats }] = await Promise.all([
    admin.from('player_achievements').select('achievement_id').eq('player_id', playerId),
    admin.from('h2h_player_stats').select('rank_points, wins, losses').eq('player_id', playerId).eq('season', CURRENT_SEASON).maybeSingle(),
  ]);

  const earnedIds = (achievementRows ?? []).map((r: { achievement_id: string }) => r.achievement_id);
  const rank = getRankFromLevel(level);
  const pvpRank = h2hStats ? getRankFromPoints(h2hStats.rank_points as number) : null;
  const wins = (h2hStats?.wins as number) ?? 0;
  const losses = (h2hStats?.losses as number) ?? 0;

  // Resolve featured badges
  const featuredBadges = featuredBadgeIds
    .map(id => ACHIEVEMENTS.find(a => a.id === id))
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-sm lg:max-w-2xl space-y-4">
        {/* Back link */}
        <Link href="/" className="text-[var(--c-secondary)] text-sm font-mono tracking-wider hover:text-[var(--c-primary)] transition-colors">
          &lt; BACK
        </Link>

        {/* Player header */}
        <div className="term-border bg-[var(--c-bg)] px-4 py-5 text-center space-y-2">
          <div className="text-[var(--c-primary)] text-xl lg:text-2xl font-mono font-bold tracking-widest">
            {displayName}
          </div>
          <div className="text-sm font-mono font-bold tracking-wider" style={{ color: rank.color }}>
            {rank.label} &middot; LVL {level}
          </div>
          {bio && (
            <div className="text-[var(--c-secondary)] text-sm font-mono mt-2 max-w-md mx-auto">
              {bio}
            </div>
          )}
          {!isOwnProfile && <AddFriendButton callsign={displayName} />}
        </div>

        {/* Featured badge shelf */}
        {featuredBadges.length > 0 && (
          <div className="term-border bg-[var(--c-bg)]">
            <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-secondary)] text-sm tracking-widest">BADGE_SHELF</span>
            </div>
            <div className="px-3 py-3">
              <div className="flex flex-wrap justify-center gap-3">
                {featuredBadges.map(badge => {
                  if (!badge) return null;
                  const color = RARITY_COLORS[badge.rarity];
                  return (
                    <div
                      key={badge.id}
                      className="flex flex-col items-center gap-1 px-3 py-2 border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] min-w-[80px]"
                      style={{ borderColor: `${color}40` }}
                    >
                      <span className="text-2xl font-mono" style={{ color }}>{badge.icon}</span>
                      <span className="text-xs font-mono font-bold tracking-wider text-center" style={{ color }}>{badge.name}</span>
                      <span className="text-xs font-mono tracking-wider" style={{ color, opacity: 0.7 }}>{badge.rarity.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">OPERATOR_STATS</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
            <div className="px-3 py-3 text-center">
              <div className="text-lg font-black font-mono text-[var(--c-primary)]">{level}</div>
              <div className="text-xs font-mono text-[var(--c-muted)] mt-0.5">LEVEL</div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="text-lg font-black font-mono text-[var(--c-primary)]">{xp.toLocaleString()}</div>
              <div className="text-xs font-mono text-[var(--c-muted)] mt-0.5">XP</div>
            </div>
            {pvpRank && (
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-black font-mono" style={{ color: pvpRank.color }}>{pvpRank.icon} {pvpRank.label}</div>
                <div className="text-xs font-mono text-[var(--c-muted)] mt-0.5">PvP RANK</div>
              </div>
            )}
            {h2hStats && (
              <div className="px-3 py-3 text-center">
                <div className="text-lg font-black font-mono text-[var(--c-primary)]">{wins}W {losses}L</div>
                <div className="text-xs font-mono text-[var(--c-muted)] mt-0.5">PvP RECORD</div>
              </div>
            )}
          </div>
        </div>

        {/* Achievements */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">ACHIEVEMENTS</span>
            <span className="text-[var(--c-secondary)] text-sm font-mono">{earnedIds.length}/{ACHIEVEMENTS.length}</span>
          </div>
          <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_6%,transparent)]">
            {(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map(cat => {
              const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
              const catEarned = catAchievements.filter(a => earnedIds.includes(a.id));
              if (catEarned.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="px-3 py-1.5 bg-[color-mix(in_srgb,var(--c-primary)_2%,transparent)]">
                    <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{CATEGORY_LABELS[cat]}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]">
                    {catEarned.map(a => {
                      const color = RARITY_COLORS[a.rarity];
                      return (
                        <div key={a.id} className="px-3 py-2 bg-[var(--c-bg)]">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-mono" style={{ color }}>{a.icon}</span>
                            <span className="text-xs font-mono font-bold tracking-wider" style={{ color }}>{a.name}</span>
                          </div>
                          <div className="text-xs font-mono mt-0.5 text-[var(--c-secondary)]">{a.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
