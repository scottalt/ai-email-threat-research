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
    date: '2026-02-28',
    category: 'milestone',
    title: 'Development begins',
    body: 'Design and development of the Threat Terminal research platform starts.',
  },
  {
    date: '2026-03-04',
    category: 'milestone',
    title: 'Dataset target scaled to 1,000 cards',
    body: 'Original 550-card target expanded to 1,000 to improve statistical power across difficulty levels and techniques.',
  },
  {
    date: '2026-03-11',
    category: 'milestone',
    title: 'Platform opens to players',
    body: 'Threat Terminal goes live. Players begin submitting phishing detection responses for the research study.',
  },
  {
    date: '2026-03-12',
    category: 'milestone',
    title: 'Final research dataset locked — 1,000 cards',
    body: 'The research card pool is finalized at 1,000 AI-generated email samples (798 Haiku, 202 Sonnet). No further changes will be made to research data.',
  },

  // Platform updates (chronological — page reverses for display)
  {
    date: '2026-03-11',
    category: 'update',
    title: 'Launch day',
    body: 'CRT terminal design, research mode, daily challenges, player accounts with XP and leveling, expert mode, rank system, red flag highlighting, URL inspector, interactive tutorial, background music, and intel analytics.',
  },
  {
    date: '2026-03-12',
    category: 'update',
    title: 'Rebrand to Threat Terminal',
    body: 'Retro Phish becomes Threat Terminal. New domain, branding, and custom favicon.',
  },
  {
    date: '2026-03-12',
    category: 'update',
    title: 'Achievements and stats dashboard',
    body: '20 achievements across 6 categories. Personal stats page with accuracy breakdown, game mode history, and performance trends.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'Daily streak XP bonus',
    body: 'Play daily challenges on consecutive days for escalating XP bonuses.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'Server-side answer verification',
    body: 'All answers verified server-side against dealt cards. Anti-cheat hardening for streaks and re-deals.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'Desktop layouts and navigation bar',
    body: 'Two-column desktop layouts for stats, profile, and intel. Persistent nav bar for signed-in users. Boot animation and readability improvements.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'Changelog',
    body: 'Research timeline and platform update history in one place.',
  },
];
