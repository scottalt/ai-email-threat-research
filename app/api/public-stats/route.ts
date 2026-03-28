import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';

export const revalidate = 300; // 5-minute ISR cache

export async function GET(req: NextRequest) {
  // Rate limit: 20 requests per IP per minute
  const ip = getClientIp(req);
  const rlKey = `ratelimit:public-stats:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 20) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = getSupabaseAdminClient();

  const [participantsResult, totalResult, correctResult] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }).gte('research_sessions_completed', 1),
    supabase.from('answers').select('id', { count: 'exact', head: true }).eq('game_mode', 'research'),
    supabase.from('answers').select('id', { count: 'exact', head: true }).eq('game_mode', 'research').eq('correct', true),
  ]);

  const participants = participantsResult.count ?? 0;
  const totalAnswers = totalResult.count ?? 0;
  const correctAnswers = correctResult.count ?? 0;
  const overallAccuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  return NextResponse.json({
    participants,
    totalAnswers,
    overallAccuracy,
    byTechnique: [], // intentionally withheld to avoid priming participants
  });
}
