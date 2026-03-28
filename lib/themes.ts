export interface ThemeColors {
  primary: string;
  secondary: string;
  muted: string;
  dark: string;
  bg: string;
  bgAlt: string;
  accent: string;
  accentDim: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  subtitle: string;
  unlockLevel: number;
  unlockLabel: string;
  colors: ThemeColors;
  nameEffect?: 'rainbow';  // special PVP name animation
  hidden?: boolean;         // hidden from theme list unless equipped
}

export const THEMES: ThemeDef[] = [
  {
    id: 'phosphor',
    name: 'PHOSPHOR',
    subtitle: 'Classic terminal green',
    unlockLevel: 1,
    unlockLabel: 'DEFAULT',
    colors: {
      primary: '#00ff41',
      secondary: '#3cc462',
      muted: '#237a3a',
      dark: '#0d4a1e',
      bg: '#0a120a',
      bgAlt: '#060e06',
      accent: '#ffaa00',
      accentDim: '#cc8800',
    },
  },
  {
    id: 'amber-crt',
    name: 'AMBER_CRT',
    subtitle: 'Vintage CRT warmth',
    unlockLevel: 7,
    unlockLabel: 'LINK_CHECKER (LVL 7)',
    colors: {
      primary: '#ffaa00',
      secondary: '#d49420',
      muted: '#8a6a28',
      dark: '#4d3a0a',
      bg: '#100e06',
      bgAlt: '#0c0a04',
      accent: '#00d4ff',
      accentDim: '#0099bb',
    },
  },
  {
    id: 'frost-bite',
    name: 'FROST_BITE',
    subtitle: 'Sub-zero recon',
    unlockLevel: 10,
    unlockLabel: 'HEADER_READER (LVL 10)',
    colors: {
      primary: '#00d4ff',
      secondary: '#40aad0',
      muted: '#2a6a8a',
      dark: '#0a4a62',
      bg: '#080e12',
      bgAlt: '#040a0e',
      accent: '#ffaa00',
      accentDim: '#cc8800',
    },
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    subtitle: 'Stealth mode engaged',
    unlockLevel: 16,
    unlockLabel: 'THREAT_HUNTER (LVL 16)',
    colors: {
      primary: '#bf5fff',
      secondary: '#a455dd',
      muted: '#6e3a95',
      dark: '#3e1a60',
      bg: '#0e0a14',
      bgAlt: '#0a060e',
      accent: '#00ff41',
      accentDim: '#00bb33',
    },
  },
  {
    id: 'red-team',
    name: 'RED_TEAM',
    subtitle: 'Offensive operations',
    unlockLevel: 22,
    unlockLabel: 'RED_TEAMER (LVL 22)',
    colors: {
      primary: '#ff5555',
      secondary: '#dd4444',
      muted: '#993030',
      dark: '#601818',
      bg: '#140808',
      bgAlt: '#0e0404',
      accent: '#00d4ff',
      accentDim: '#0099bb',
    },
  },
  {
    id: 'ghost-protocol',
    name: 'GHOST_PROTOCOL',
    subtitle: 'Zero footprint',
    unlockLevel: 28,
    unlockLabel: 'ZERO_DAY (LVL 28)',
    colors: {
      primary: '#e8e8e8',
      secondary: '#aaaaaa',
      muted: '#666666',
      dark: '#404040',
      bg: '#0e0e0e',
      bgAlt: '#0a0a0a',
      accent: '#ffaa00',
      accentDim: '#cc8800',
    },
  },
  {
    id: 'singularity',
    name: 'SINGULARITY',
    subtitle: 'Beyond the event horizon',
    unlockLevel: 99, // unreachable — admin-granted only
    unlockLabel: '???',
    nameEffect: 'rainbow',
    hidden: true,
    colors: {
      primary: '#ffffff',
      secondary: '#bb99ff',
      muted: '#6644aa',
      dark: '#331a66',
      bg: '#0a0610',
      bgAlt: '#060410',
      accent: '#ff0080',
      accentDim: '#cc0066',
    },
  },
];

export function getThemeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function isThemeUnlocked(theme: ThemeDef, playerLevel: number, graduated: boolean, playerThemeId?: string, unlockedThemes?: string[]): boolean {
  if (theme.id === 'phosphor') return true;
  if (playerThemeId === theme.id) return true;
  if (unlockedThemes?.includes(theme.id)) return true;
  if (theme.hidden) return false;
  return graduated && playerLevel >= theme.unlockLevel;
}
