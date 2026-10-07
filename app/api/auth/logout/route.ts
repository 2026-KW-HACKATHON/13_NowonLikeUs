import { clearSessionCookie } from '@/lib/auth';

/** POST /api/auth/logout — 로그인하지 않은 상태여도 204 다. */
export async function POST() {
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
