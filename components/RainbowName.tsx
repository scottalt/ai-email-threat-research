'use client';

import { useTheme } from '@/lib/ThemeContext';
import { getThemeById } from '@/lib/themes';

/**
 * Renders a player name with theme-appropriate styling:
 * - Rainbow effect for SINGULARITY theme (nameEffect='rainbow')
 * - Theme primary color for all other themes
 * - Falls back to fallbackColor or the current player's theme
 *
 * For the current player: omit themeId (reads from ThemeContext)
 * For other players: pass themeId or themeColor directly
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

  // Determine if rainbow: explicit nameEffect prop, or resolved from themeId
  const resolvedTheme = themeId ? getThemeById(themeId) : currentTheme;
  const isRainbow = nameEffect === 'rainbow' || resolvedTheme.nameEffect === 'rainbow';

  if (isRainbow) {
    return (
      <span className={`rainbow-name-glow ${className}`}>
        <span className="rainbow-name">{name}</span>
      </span>
    );
  }

  // Use explicit themeColor, or derive from themeId, or use fallbackColor
  const color = themeColor ?? (themeId ? getThemeById(themeId).colors.primary : null) ?? fallbackColor;

  return (
    <span className={className} style={color ? { color } : undefined}>
      {name}
    </span>
  );
}
