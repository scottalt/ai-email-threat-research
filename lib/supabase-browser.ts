import { createBrowserClient } from '@supabase/ssr';

// Browser-only Supabase client — used ONLY for auth (signInWithOtp, getSession, onAuthStateChange, signOut)
// All data reads/writes go through our API routes which use the service role key
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return createBrowserClient(url, key);
}
