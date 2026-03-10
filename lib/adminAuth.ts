import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function isAdminUser(authId: string | null | undefined): boolean {
  const adminUserId = process.env.ADMIN_USER_ID;
  return !!adminUserId && !!authId && authId === adminUserId;
}

/**
 * Server-side admin gate for API routes. Returns null if the caller is the
 * admin user, or a 403 NextResponse to return immediately if not.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user?.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
