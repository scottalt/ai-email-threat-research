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

  {
    date: '2026-03-22',
    category: 'milestone',
    title: 'v2.0 — Head-to-Head competitive mode',
    body: 'Real-time 1v1 matchmaking. Race through 5 emails against another player. Wrong answer eliminates you. Fastest perfect run wins. Seasonal ranked tiers from Bronze to Elite. Climb the ladder, defend your rank.',
  },

  {
    date: '2026-03-22',
    category: 'milestone',
    title: 'Phase 2 begins — streamlined for technique detection',
    body: 'After observing Phase 1 data and player behaviour, we identified that three supplementary signals were distracting from the core research question rather than supporting it. Authentication headers, while not a perfect shortcut, were discouraging players from engaging with the email content. Many checked PASS/FAIL first and anchored on that instead of reading the message. Reply-To and Send Time added noise without meaningfully aiding detection. These have been removed so the task focuses squarely on what we set out to measure: which phishing techniques do humans miss when the writing quality is no longer a tell? Phase 1 data is preserved for comparison.',
  },

  // Platform updates (chronological — page reverses for display)
  // Only significant, player-facing changes — not every commit
  {
    date: '2026-03-11',
    category: 'update',
    title: 'v1.0.0 — Platform launch',
    body: 'Research mode, daily challenges, expert mode, player accounts with XP and leveling, interactive tutorial, and intel analytics.',
  },
  {
    date: '2026-03-12',
    category: 'update',
    title: 'v1.1.0 — Achievements and stats',
    body: '20 achievements to unlock. Personal stats dashboard with accuracy breakdown and performance history.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'v1.2.0 — Daily streaks',
    body: 'Play daily challenges on consecutive days for escalating XP bonuses.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'v1.3.0 — Navigation and desktop layouts',
    body: 'Persistent nav bar, two-column desktop layouts, boot animation, and readability improvements.',
  },
  {
    date: '2026-03-13',
    category: 'update',
    title: 'v1.4.0 — Changelog',
    body: 'Research timeline and platform update history.',
  },
  {
    date: '2026-03-14',
    category: 'update',
    title: 'v1.5.0 — Improved sign-in flow',
    body: 'Sign-in and callsign setup now appear inline below the Play button. No more scrolling up to find the sign-in form on mobile.',
  },
  {
    date: '2026-03-15',
    category: 'update',
    title: 'v1.6.0 — Share your results',
    body: 'Share your score from the round summary. Uses your device\'s native share sheet on mobile, or copies to clipboard on desktop.',
  },
  {
    date: '2026-03-16',
    category: 'update',
    title: 'v1.7.0 — Terminal themes, XP cooldown, and QoL fixes',
    body: '6 unlockable terminal color themes (Phosphor, Amber Alert, Frost Bite, Phantom, Red Team, Ghost Protocol) — graduate research and rank up to unlock them. XP cooldown indicator with live countdown timer. "What\'s New" unread dot. Intel stats now show full dataset beyond 1,000 answers.',
  },
  {
    date: '2026-03-20',
    category: 'update',
    title: 'v1.8.0 — Landing page and desktop improvements',
    body: 'New landing page for first-time visitors with live research stats. Wider email cards on desktop with full email body visible (no scrolling required). Two-column research intro layout on desktop. Improved text readability across the board.',
  },
  {
    date: '2026-03-22',
    category: 'update',
    title: 'v1.9.0 — Simplified email view',
    body: 'Email authentication headers (SPF/DKIM/DMARC), Reply-To, and Send Time have been removed from the game view. These fields were inconsistently populated across the card deck, creating potential confounds. The game now focuses purely on identifying phishing techniques from email content, sender details, and URLs.',
  },
  {
    date: '2026-03-22',
    category: 'update',
    title: 'v2.0.0 — Head-to-Head mode + unlock ladder',
    body: 'New competitive mode: 1v1 ranked matches in real time. 5 cards, same deck, pure speed. Wrong answer eliminates. Seasonal ranks from Bronze to Elite with skill-based point scaling. Expert mode merged into Freeplay. New unlock progression: 10 research answers unlocks H2H, 20 unlocks Daily Challenge, 30 unlocks Freeplay.',
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
 * 2026-03-15  Share results button on round summary (navigator.share + clipboard fallback)
 * 2026-03-22  Remove auth headers from game UI (Phase 2) — confound with difficulty
 * 2026-03-22  Add auth_visible column to answers for phase 1/2 partitioning
 * 2026-03-22  Remove Reply-To from UI — only exists on phishing cards (298/0), dead giveaway confound
 * 2026-03-22  Remove SENT row from UI — inconsistently populated (~60% missing across both types)
 * 2026-03-22  v2.0.0 — Head-to-Head competitive mode (Season 0)
 * 2026-03-22  Supabase Realtime Broadcast for live match communication
 * 2026-03-22  7-tier rank system (Bronze → Elite), skill-based point scaling
 * 2026-03-22  Server-side timing verification (Redis render timestamps)
 * 2026-03-22  Merge Expert into Freeplay (single combined card pool)
 * 2026-03-22  Tiered unlock ladder: 10 → H2H, 20 → Daily, 30 → Freeplay
 * 2026-03-22  Lower research graduation threshold from 30 to 10 answers
 * 2026-03-22  Ghost matches for empty queue (unrated, 30s timeout)
 * 2026-03-22  Anti-cheat: participant verification, idempotent finalization, rate limiting
 */
