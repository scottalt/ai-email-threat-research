import { createClient } from '@supabase/supabase-js';

function getUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set');
  return url;
}

function getAnonKey() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY is not set');
  return key;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

// Read-only client for public data queries (API routes only — never browser)
export function getSupabaseClient() {
  return createClient(getUrl(), getAnonKey());
}

// Admin client for inserts and privileged reads (API routes only — never browser)
export function getSupabaseAdminClient() {
  return createClient(getUrl(), getServiceKey());
}

/**
 * Fetch all rows from a Supabase query by paginating in batches.
 * Supabase caps responses at 1,000 rows by default.
 */
export async function fetchAllRows<T>(
  queryFn: (range: { from: number; to: number }) => PromiseLike<{ data: T[] | null; error: unknown }>,
  batchSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await queryFn({ from, to });
    if (error || !data) break;
    all.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}
