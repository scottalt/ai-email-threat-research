import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCookie } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('admin_session')?.value;
  return NextResponse.json({ isAdmin: verifyAdminCookie(cookie) });
}
