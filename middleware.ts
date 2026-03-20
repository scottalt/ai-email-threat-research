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

  const { data: { user }, error } = await supabase.auth.getUser();

  // If the refresh token was already consumed by a concurrent request, clear the
  // stale auth cookies so the browser client picks up the newer tokens from its
  // own in-memory state on the next request instead of retrying the dead token.
  if (error?.code === 'refresh_token_already_used') {
    const authCookiePrefix = 'sb-';
    req.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith(authCookiePrefix)) {
        response.cookies.delete(name);
      }
    });
    // Non-admin routes can proceed anonymously; admin routes redirect below.
  }

  // Signed-in users on landing page → redirect to game
  if (pathname === '/' && user) {
    const url = req.nextUrl.clone();
    url.pathname = '/play';
    return NextResponse.redirect(url);
  }

  // Protect admin routes — must be the designated admin Supabase user
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin');

  if (isAdminRoute) {
    const adminUserId = process.env.ADMIN_USER_ID;
    if (!adminUserId || user?.id !== adminUserId) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Run on all page requests, skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|robots.txt|sitemap.xml|opengraph-image|icon.svg|og-image.png).*)',
  ],
};
