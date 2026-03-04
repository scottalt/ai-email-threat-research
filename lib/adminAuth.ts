import { createHmac } from 'crypto';

export function verifyAdminCookie(cookieValue: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !cookieValue) return false;
  const dot = cookieValue.indexOf('.');
  if (dot === -1) return false;
  const nonce = cookieValue.slice(0, dot);
  const hmac = cookieValue.slice(dot + 1);
  const expectedHmac = createHmac('sha256', expected).update(nonce).digest('hex');
  return expectedHmac === hmac;
}
