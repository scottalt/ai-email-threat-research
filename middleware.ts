import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes (not /api/admin/login)
  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isAdminApi = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login');

  if (isAdminPage || isAdminApi) {
    const token = req.cookies.get('admin_session')?.value;
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected || !token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }

    // Verify HMAC token: nonce.HMAC(nonce, password)
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
    const nonce = token.slice(0, dotIndex);
    const providedHmac = token.slice(dotIndex + 1);
    const expectedHmac = createHmac('sha256', expected).update(nonce).digest('hex');

    if (providedHmac !== expectedHmac) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
