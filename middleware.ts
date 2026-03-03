import { NextRequest, NextResponse } from 'next/server';

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
