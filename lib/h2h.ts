// ── H2H (Head-to-Head) shared constants, types, and helpers ──

// ── Constants ──

export const H2H_CARDS_PER_MATCH = 5;
export const H2H_QUEUE_TIMEOUT_MS = 30_000;
export const H2H_MATCH_TTL = 60 * 30; // 30 min Redis TTL
export const H2H_AFK_TIMEOUT_MS = 90_000; // 90s per-card inactivity timeout
export const H2H_DAILY_RATED_CAP = 20;
export const H2H_DAILY_HALF_RATE_AFTER = 10;
export const CURRENT_SEASON = 'season-0';

// ── Bot names for solo matches ──

const BOT_NAMES = [
  'AGENT_SMITH', 'PROXY_NULL', 'ZERO_COOL', 'CRASH_OVERRIDE', 'ACID_BURN',
  'THE_PLAGUE', 'DARK_TANGENT', 'ROOT_KIT', 'PACKET_STORM', 'BYTE_FORCE',
  'CIPHER_NET', 'STACK_TRACE', 'KERN_PANIC', 'DEAD_DROP', 'WIRE_SHARK',
  'NET_SCOUT', 'HASH_CRACK', 'PORT_SCAN', 'SHELL_CODE', 'BRUTE_FORCE',
  'LOGIC_BOMB', 'TRAP_DOOR', 'FIRE_WALL', 'SAND_BOX', 'HONEY_POT',
];

export function getRandomBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

// ── Rank system ──

export interface H2HRank {
  tier: string;
  label: string;
  icon: string;
  minPoints: number;
  color: string;
}

export const H2H_RANKS: H2HRank[] = [
  { tier: 'bronze',   label: 'BRONZE',   icon: '◇',  minPoints: 0,    color: '#003a0e' },
  { tier: 'silver',   label: 'SILVER',   icon: '◆',  minPoints: 100,  color: '#00aa28' },
  { tier: 'gold',     label: 'GOLD',     icon: '◆◆', minPoints: 250,  color: '#ffaa00' },
  { tier: 'platinum', label: 'PLATINUM', icon: '⬡',  minPoints: 450,  color: '#00aaff' },
  { tier: 'diamond',  label: 'DIAMOND',  icon: '⬡⬡', minPoints: 700,  color: '#ff0080' },
  { tier: 'master',   label: 'MASTER',   icon: '★',  minPoints: 1000, color: '#ff3333' },
  { tier: 'elite',    label: 'ELITE',    icon: '★★', minPoints: 1400, color: '#ffd700' },
];

// ── Rank helpers ──

/** Return the highest rank whose minPoints threshold the player has reached. */
export function getRankFromPoints(points: number): H2HRank {
  let rank = H2H_RANKS[0];
  for (const r of H2H_RANKS) {
    if (points >= r.minPoints) rank = r;
  }
  return rank;
}

/** Return the index of a tier in the ranks array (0-based). */
export function getRankIndex(tier: string): number {
  return H2H_RANKS.findIndex((r) => r.tier === tier);
}

// ── Points calculation ──

/**
 * Calculate the ranked-points delta for a single player after a match.
 *
 * - Tier difference drives the base value (upset wins reward more, etc.).
 * - Daily diminishing returns: after HALF_RATE_AFTER rated matches the delta
 *   is halved; at or above DAILY_RATED_CAP the delta is 0.
 * - The caller is responsible for flooring the player's total at 0.
 */
export function calculatePointsDelta(
  winnerTier: string,
  loserTier: string,
  isWinner: boolean,
  ratedMatchesToday: number,
): number {
  const winnerIdx = getRankIndex(winnerTier);
  const loserIdx = getRankIndex(loserTier);
  const tierDiff = winnerIdx - loserIdx; // positive = winner is higher ranked

  let delta: number;

  if (isWinner) {
    if (tierDiff >= 2) delta = 8;        // 2+ tiers above loser — expected win, small reward
    else if (tierDiff === 1) delta = 14; // 1 tier above — still expected
    else if (tierDiff === 0) delta = 20; // same tier — fair match
    else if (tierDiff === -1) delta = 30; // 1 tier below — upset
    else delta = 40;                      // 2+ tiers below — big upset
  } else {
    // Losses — symmetric at same tier, harsher for losing to lower ranks
    if (tierDiff >= 2) delta = -35;       // lost to someone 2+ tiers below — embarrassing
    else if (tierDiff === 1) delta = -28; // lost to someone 1 tier below
    else if (tierDiff === 0) delta = -20; // same tier — fair match
    else if (tierDiff === -1) delta = -12; // lost to someone 1 tier above — expected
    else delta = -8;                       // lost to someone 2+ tiers above — no shame
  }

  // Daily diminishing returns
  if (ratedMatchesToday >= H2H_DAILY_RATED_CAP) return 0;
  if (ratedMatchesToday >= H2H_DAILY_HALF_RATE_AFTER) {
    delta = Math.round(delta / 2);
  }

  return delta;
}

// ── Interfaces ──

export interface H2HPlayerStats {
  playerId: string;
  season: string;
  rankPoints: number;
  rank: H2HRank;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  peakRankPoints: number;
  ratedMatchesToday: number;
}

export interface H2HMatch {
  id: string;
  season: string;
  player1Id: string;
  player2Id: string | null;
  cardIds: string[];
  status: string;
  winnerId: string | null;
  isGhostMatch: boolean;
  isRated: boolean;
  startedAt: number | null;
  endedAt: number | null;
}
