import { Page } from '@playwright/test';

/**
 * Inject Supabase auth session into the browser.
 *
 * @supabase/ssr (v0.9+) uses cookies for session storage.
 * The cookie name format is: sb-<project-ref>-auth-token
 * We also set localStorage as a fallback.
 */
export async function injectSession(
  page: Page,
  supabaseUrl: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const domain = new URL(page.url() || 'http://localhost').hostname;

  const sessionPayload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  // Set the auth cookie that @supabase/ssr reads
  await page.context().addCookies([
    {
      name: cookieName,
      value: encodeURIComponent(sessionPayload),
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Also set localStorage as fallback
  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, payload);
    },
    { key: cookieName, payload: sessionPayload },
  );
}
