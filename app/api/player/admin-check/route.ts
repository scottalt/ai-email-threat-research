import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAdminUser } from '@/lib/adminAuth';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log('[admin-check]', { userId: user?.id, adminId: process.env.ADMIN_USER_ID, match: user?.id === process.env.ADMIN_USER_ID, error: error?.message });
  if (!isAdminUser(user?.id)) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ ok: true });
}
