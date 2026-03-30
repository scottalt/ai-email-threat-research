'use client';

import { useTheme } from '@/lib/ThemeContext';
import { getThemeById } from '@/lib/themes';

/**
 * Renders a player name with theme-appropriate styling.
 *
 * For the CURRENT player's own name: omit themeId/themeColor/nameEffect.
 *   → reads from ThemeContext (their equipped theme)
 *
 * For OTHER players (leaderboards, PVP): pass themeId, themeColor, or nameEffect.
 *   → uses only the provided values, never falls back to current player's theme
 */
export function RainbowName({
  name,
  themeId,
  themeColor,
  nameEffect,
  className = '',
  fallbackColor,
}: {
  name: string;
  themeId?: string;
  themeColor?: string | null;
  nameEffect?: string | null;
  className?: string;
  fallbackColor?: string;
}) {
  const { theme: currentTheme } = useTheme();

  // Is this rendering another player's name? (any external prop provided, even if null)
  const isOtherPlayer = themeId !== undefined || themeColor !== undefined || nameEffect !== undefined;

  // Rainbow check: explicit nameEffect, or themeId resolves to rainbow
  const isRainbow = nameEffect === 'rainbow'
    || (themeId ? getThemeById(themeId).nameEffect === 'rainbow' : false)
    || (!isOtherPlayer && currentTheme.nameEffect === 'rainbow');

  if (isRainbow) {
    return (
      <span className={`rainbow-name-glow ${className}`}>
        <span className="rainbow-name">{name}</span>
      </span>
    );
  }

  // Color: explicit themeColor → derive from themeId → current player's theme → fallback
  let color: string | undefined;
  if (themeColor) color = themeColor;
  else if (themeId) color = getThemeById(themeId).colors.primary;
  else if (!isOtherPlayer) color = undefined; // inherit from parent (current player's theme via CSS vars)
  else color = fallbackColor;

  return (
    <span className={className} style={color ? { color } : undefined}>
      {name}
    </span>
  );
}
