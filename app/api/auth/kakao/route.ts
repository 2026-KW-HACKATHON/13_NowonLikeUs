import { redirect } from 'next/navigation';
import { setKakaoStateCookie } from '@/lib/auth';
import { safeNext } from '@/lib/authView';
import { encodeStateCookie, kakaoAuthorizeUrl, kakaoCallbackUrl, kakaoConfig } from '@/lib/kakao';

/**
 * GET /api/auth/kakao?next=/questions — 카카오 로그인 시작.
 * state 를 쿠키에 담고 카카오 로그인 화면으로 보낸다. 돌아갈 화면(next)은 이 사이트 안 경로만.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next') ?? undefined);

  const config = kakaoConfig(process.env);
  if (!config) redirect(`/login?kakao=unavailable&next=${encodeURIComponent(next)}`);

  // 32바이트 난수. 콜백에서 같은 값이 돌아와야 내가 시작한 로그인이다.
  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  await setKakaoStateCookie(encodeStateCookie(state, next));

  redirect(kakaoAuthorizeUrl({ clientId: config.clientId, redirectUri: kakaoCallbackUrl(url.origin), state }));
}
