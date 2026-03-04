import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Refresh Supabase session and get current user on every request
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect admin routes — must be the designated admin Supabase user
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin');

  if (isAdminRoute) {
    const adminUserId = process.env.ADMIN_USER_ID;
    if (!adminUserId || user?.id !== adminUserId) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Run on all page requests, skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)',
  ],
};
