export interface Rank {
  label: string;
  color: string;
  glowClass: string;
}

const MAX_SCORE = 3000;

export function getRank(score: number): Rank {
  const efficiency = score / MAX_SCORE;
  if (efficiency >= 0.9) return { label: 'ELITE',      color: '#ffaa00', glowClass: 'glow-amber' };
  if (efficiency >= 0.75) return { label: 'SPECIALIST', color: '#ffaa00', glowClass: '' };
  if (efficiency >= 0.6)  return { label: 'ANALYST',    color: '#00ff41', glowClass: 'glow' };
  if (efficiency >= 0.4)  return { label: 'OPERATOR',   color: '#00ff41', glowClass: '' };
  return                         { label: 'NOVICE',     color: '#00aa28', glowClass: '' };
}
