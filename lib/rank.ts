export interface Rank {
  label: string;
  color: string;
  glowClass: string;
}

// 30 levels / 10 ranks = 3 levels per rank
export function getRankFromLevel(level: number): Rank {
  if (level >= 28) return { label: 'ZERO_DAY',         color: '#ff3333', glowClass: 'glow-red'   };
  if (level >= 25) return { label: 'APT_ANALYST',      color: '#ff4400', glowClass: ''           };
  if (level >= 22) return { label: 'RED_TEAMER',       color: '#ffaa00', glowClass: 'glow-amber' };
  if (level >= 19) return { label: 'INCIDENT_HANDLER', color: '#ffaa00', glowClass: ''           };
  if (level >= 16) return { label: 'THREAT_HUNTER',    color: '#ffcc00', glowClass: ''           };
  if (level >= 13) return { label: 'SOC_ANALYST',      color: '#00ff41', glowClass: 'glow'       };
  if (level >= 10) return { label: 'HEADER_READER',    color: '#00ff41', glowClass: ''           };
  if (level >= 7)  return { label: 'LINK_CHECKER',     color: '#00aa28', glowClass: ''           };
  if (level >= 4)  return { label: 'PHISH_BAIT',       color: '#447744', glowClass: ''           };
  return                  { label: 'CLICK_HAPPY',      color: '#2a4a2a', glowClass: ''           };
}
