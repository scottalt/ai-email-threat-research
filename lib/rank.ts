export interface Rank {
  label: string;
  color: string;
  glowClass: string;
}

// 30 levels / 5 ranks = 6 levels per rank
export function getRankFromLevel(level: number): Rank {
  if (level >= 25) return { label: 'ELITE',      color: '#ffaa00', glowClass: 'glow-amber' };
  if (level >= 19) return { label: 'SPECIALIST', color: '#ffaa00', glowClass: '' };
  if (level >= 13) return { label: 'ANALYST',    color: '#00ff41', glowClass: 'glow' };
  if (level >= 7)  return { label: 'OPERATOR',   color: '#00ff41', glowClass: '' };
  return                  { label: 'NOVICE',     color: '#00aa28', glowClass: '' };
}
