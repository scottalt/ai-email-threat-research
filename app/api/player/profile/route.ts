import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import filter from 'leo-profanity';
import { isAdminUser } from '@/lib/adminAuth';

const VALID_PRIVACY_LEVELS = ['public', 'friends', 'private'] as const;
const MAX_BIO_LENGTH = 200;
const MAX_FEATURED_BADGES = 5;

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// PATCH /api/player/profile — update bio, privacy level, and/or featured badges shelf
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Validate bio
  if ('bio' in body) {
    if (typeof body.bio !== 'string') {
      return NextResponse.json({ error: 'Invalid bio' }, { status: 400 });
    }
    const cleaned = body.bio.trim().slice(0, MAX_BIO_LENGTH);
    const admin = isAdminUser(authId);

    if (!admin) {
      // Block HTML/script injection
      if (/[<>]/.test(cleaned)) {
        return NextResponse.json({ error: 'Bio cannot contain < or > characters.' }, { status: 400 });
      }

      // Block URLs (http, https, www, common TLDs)
      if (/https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|\.gg\b|\.dev\b|\.xyz\b|\.me\b/i.test(cleaned)) {
        return NextResponse.json({ error: 'URLs are not allowed in bios.' }, { status: 400 });
      }

      // Block code/script patterns
      if (/javascript:|data:|on\w+=|eval\(|alert\(|document\.|window\.|<script|<\/script|\{[\s\S]*\}|function\s*\(/i.test(cleaned)) {
        return NextResponse.json({ error: 'Invalid bio content.' }, { status: 400 });
      }

      // Block excessive special characters (allow basic punctuation)
      if (/[{}[\]\\|`~^]/.test(cleaned)) {
        return NextResponse.json({ error: 'Bio contains unsupported characters.' }, { status: 400 });
      }

      // Profanity filter
      if (filter.check(cleaned)) {
        return NextResponse.json({ error: 'Keep it clean, operative.' }, { status: 400 });
      }
    }

    updates.bio = cleaned;
  }

  // Audio settings
  if (typeof body.sfxEnabled === 'boolean') updates.sfx_enabled = body.sfxEnabled;
  if (typeof body.musicEnabled === 'boolean') updates.music_enabled = body.musicEnabled;

  // Validate privacyLevel
  if ('privacyLevel' in body) {
    if (!VALID_PRIVACY_LEVELS.includes(body.privacyLevel)) {
      return NextResponse.json({ error: 'Invalid privacy level' }, { status: 400 });
    }
    updates.privacy_level = body.privacyLevel;
  }

  const admin = getSupabaseAdminClient();

  // Validate featuredBadges
  if ('featuredBadges' in body) {
    if (!Array.isArray(body.featuredBadges)) {
      return NextResponse.json({ error: 'featuredBadges must be an array' }, { status: 400 });
    }
    if (body.featuredBadges.length > MAX_FEATURED_BADGES) {
      return NextResponse.json({ error: `Max ${MAX_FEATURED_BADGES} featured badges` }, { status: 400 });
    }
    if (!body.featuredBadges.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json({ error: 'Each featured badge must be a non-empty string' }, { status: 400 });
    }

    // Look up the player to validate badge ownership
    const { data: player } = await admin
      .from('players')
      .select('id')
      .eq('auth_id', authId)
      .single();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Verify all badges are earned
    if (body.featuredBadges.length > 0) {
      const { data: earned } = await admin
        .from('player_achievements')
        .select('achievement_id')
        .eq('player_id', player.id as string)
        .in('achievement_id', body.featuredBadges);

      const earnedIds = new Set((earned ?? []).map((r: { achievement_id: string }) => r.achievement_id));
      const unearned = body.featuredBadges.filter((id: string) => !earnedIds.has(id));
      if (unearned.length > 0) {
        return NextResponse.json({ error: 'Some badges not earned' }, { status: 403 });
      }
    }

    updates.featured_badges = body.featuredBadges;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await admin
    .from('players')
    .update(updates)
    .eq('auth_id', authId);

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
