export function isAdminUser(authId: string | null | undefined): boolean {
  const adminUserId = process.env.ADMIN_USER_ID;
  return !!adminUserId && !!authId && authId === adminUserId;
}
