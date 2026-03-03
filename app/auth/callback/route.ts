import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const rawNext = req.nextUrl.searchParams.get('next') ?? '';
  const redirectTo = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (!code) return NextResponse.redirect(new URL('/', req.url));

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !session) return NextResponse.redirect(new URL('/', req.url));

  // Upsert player record on first sign in
  const admin = getSupabaseAdminClient();
  const { error: upsertError } = await admin.from('players').upsert(
    { auth_id: session.user.id },
    { onConflict: 'auth_id', ignoreDuplicates: true }
  );
  if (upsertError) {
    console.error('[auth/callback] player upsert failed:', upsertError.message);
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
