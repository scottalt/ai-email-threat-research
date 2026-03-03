import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function redirectToLogin(req: NextRequest) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  return NextResponse.redirect(loginUrl);
}

// Web Crypto HMAC verification — Edge Runtime compatible (no Node.js crypto)
async function verifyToken(token: string, secret: string): Promise<boolean> {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const nonce = token.slice(0, dotIndex);
  const providedHex = token.slice(dotIndex + 1);

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const providedBytes = new Uint8Array(
      providedHex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []
    );
    return crypto.subtle.verify('HMAC', key, providedBytes, encoder.encode(nonce));
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isAdminApi = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login');

  if (isAdminPage || isAdminApi) {
    const token = req.cookies.get('admin_session')?.value;
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected || !token) return redirectToLogin(req);

    const valid = await verifyToken(token, expected);
    if (!valid) return redirectToLogin(req);
  }

  // Refresh Supabase session on every page request so tokens stay valid
  // across browser closes. This is the standard @supabase/ssr pattern.
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

  // Triggers token refresh if the access token is expired but refresh token is valid
  await supabase.auth.getUser();

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
