import { createBrowserClient } from '@supabase/ssr';

// Browser-only Supabase client — used ONLY for auth (signInWithOtp, getSession, onAuthStateChange, signOut)
// All data reads/writes go through our API routes which use the service role key
// Singleton: prevents multiple instances from racing to refresh the same token
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
