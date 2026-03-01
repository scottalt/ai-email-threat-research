import { createClient } from '@supabase/supabase-js';

function getUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set');
  return url;
}

function getAnonKey() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
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
