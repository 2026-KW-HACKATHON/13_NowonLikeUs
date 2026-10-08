import { getSessionUser } from '@/lib/auth';
import type { MeResponse } from '@/lib/types';

/**
 * GET /api/auth/me — 지금 로그인한 사용자.
 * 로그인하지 않았으면 401 이 아니라 200 + { user: null } 이다. "로그인 안 함"은 정상 상태다.
 */
export async function GET() {
  const response: MeResponse = { user: await getSessionUser() };
  return Response.json(response);
}
