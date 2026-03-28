import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

/** Get the real client IP from Vercel's trusted x-real-ip header only */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? 'unknown';
}
