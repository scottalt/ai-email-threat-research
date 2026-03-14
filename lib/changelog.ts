export type ChangelogCategory = 'milestone' | 'update';

export interface ChangelogEntry {
  date: string;
  category: ChangelogCategory;
  title: string;
  body?: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  // Research milestones (chronological)
  {
    date: '2026-03-11',
    category: 'milestone',
    title: 'Research dataset v1 locked — platform opens to players',
    body: '1,000 AI-generated email samples finalized. Research mode, daily challenges, player accounts, XP progression, and intel analytics available from day one.',
  },

  // Platform updates (chronological — page reverses for display)
  // Only significant, player-facing changes — not every commit
  {
    date: '2026-03-11',
    category: 'update',
    title: 'Platform launch',
    body: 'Research mode, daily challenges, expert mode, player accounts with XP and leveling, interactive tutorial, and intel analytics.',
  },
  {
    date: '2026-03-12',
    category: 'update',
    title: 'Achievements and stats',
    body: '20 achievements to unlock. Personal stats dashboard with accuracy breakdown and performance history.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'Navigation and desktop layouts',
    body: 'Persistent nav bar, two-column desktop layouts, daily streak bonuses, and changelog.',
  },
];

/*
 * Detailed change archive (not shown to users — for internal reference)
 *
 * 2026-02-28  Initial build, CRT terminal design, confidence betting, card bank
 * 2026-03-01  Daily challenge mode with seeded decks and daily leaderboard
 * 2026-03-01  Red flag highlighting and URL inspector on feedback cards
 * 2026-03-01  Rank system (10 XP-based ranks), chiptune sound effects
 * 2026-03-01  Research methodology documentation
 * 2026-03-01  Supabase schema, research cards API, answer logging pipeline
 * 2026-03-01  Intel analytics page (participants, bypass rates, backgrounds)
 * 2026-03-02  Supabase auth, XP system, player profiles, expert mode
 * 2026-03-03  Player accounts: magic link sign-in, callsign, XP, leveling
 * 2026-03-03  Confidence penalty scoring (wrong + certain = point loss)
 * 2026-03-03  Security hardening: auth gates, rate limiting, XP dedup
 * 2026-03-03  Background music (looping synthwave track)
 * 2026-03-03  Terminal sounds for clicks and keypresses
 * 2026-03-03  iOS PWA auth fix (OTP code instead of magic link)
 * 2026-03-04  Admin dashboard, review queue, dataset export
 * 2026-03-04  Dataset target scaled from 550 to 1,000 cards
 * 2026-03-06  CRT aesthetic overhaul: scanlines, phosphor glow, iOS polish
 * 2026-03-06  Research answer cap (30 per player)
 * 2026-03-08  Music autoplay fix, SFX toggle improvements
 * 2026-03-09  Interactive tutorial card for first-time research players
 * 2026-03-09  Intel page: learning curve and reading depth panels
 * 2026-03-09  Editable callsign on profile page
 * 2026-03-10  Race condition fixes, error handling, card dedup
 * 2026-03-10  Custom 404 page, accessibility improvements (aria-labels)
 * 2026-03-10  Remove swipe-to-answer (prevent accidental submissions on mobile)
 * 2026-03-11  Pre-launch hardening: analytics, rate limiting, error sanitization
 * 2026-03-11  Intel page: admin-only full view, player view with graduation gate
 * 2026-03-11  Platform opens to players
 * 2026-03-12  Rebrand from Retro Phish to Threat Terminal
 * 2026-03-12  Achievements system (20 badges across 6 categories)
 * 2026-03-12  Personal stats dashboard
 * 2026-03-12  XP rate limiting and spam detection
 * 2026-03-13  Daily streak XP bonus system
 * 2026-03-13  Server-side answer verification for all game modes
 * 2026-03-13  Anti-cheat: server-side streak, prevent re-deal, verify answer logs
 * 2026-03-13  E2E tests and CI pipeline
 * 2026-03-13  Desktop two-column layouts (stats, profile, intel)
 * 2026-03-13  Persistent nav bar (top desktop, bottom mobile)
 * 2026-03-13  Boot animation, color contrast improvements
 * 2026-03-13  SFX defaults to off, sessionStorage instead of localStorage
 * 2026-03-13  Changelog page
 */
