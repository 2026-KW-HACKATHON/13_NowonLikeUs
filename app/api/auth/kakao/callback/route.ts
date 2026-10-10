import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { setKakaoPendingCookie, setSessionCookie, takeKakaoStateCookie } from '@/lib/auth';
import {
  KAKAO_ME_URL,
  KAKAO_TOKEN_URL,
  checkStateCookie,
  kakaoCallbackUrl,
  kakaoConfig,
  kakaoTokenBody,
  parseKakaoId,
  parseKakaoToken,
  readCallbackQuery,
  type KakaoLoginError,
} from '@/lib/kakao';

/** 카카오 서버가 늦어도 로그인 화면이 하염없이 돌지 않게 끊는다. */
const KAKAO_TIMEOUT_MS = 8_000;

/**
 * GET /api/auth/kakao/callback — 카카오가 돌려보내는 곳.
 *
 * state 확인 → 인가 코드로 토큰 → 토큰으로 회원번호. 토큰은 회원번호를 읽는 데만 쓰고 저장하지 않는다.
 * 이미 가입한 회원번호면 바로 로그인, 처음이면 닉네임 정하기 화면으로 보낸다.
 * 어디서 실패하든 로그인 화면으로 돌려보내고 이유만 짧게 알린다 — 카카오 응답 내용은 화면에 싣지 않는다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = readCallbackQuery(url.searchParams);
  const stateCookie = await takeKakaoStateCookie();

  if ('error' in query) fail(query.error);
  const checked = checkStateCookie(stateCookie, query.state);
  if (!checked) fail('failed');

  const config = kakaoConfig(process.env);
  if (!config) fail('unavailable', checked.next);

  const kakaoId = await fetchKakaoId(config, kakaoCallbackUrl(url.origin), query.code);
  if (!kakaoId) fail('failed', checked.next);

  const user = await prisma.user.findUnique({ where: { kakaoId }, select: { id: true, nickname: true, role: true } });
  if (user) {
    await setSessionCookie(user);
    redirect(checked.next);
  }

  await setKakaoPendingCookie({ kakaoId, next: checked.next });
  redirect('/signup/kakao');
}

function fail(reason: KakaoLoginError, next?: string): never {
  const back = next ? `&next=${encodeURIComponent(next)}` : '';
  redirect(`/login?kakao=${reason}${back}`);
}

async function fetchKakaoId(
  config: { clientId: string; clientSecret?: string },
  redirectUri: string,
  code: string,
): Promise<string | null> {
  try {
    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: kakaoTokenBody({ ...config, redirectUri, code }),
      signal: AbortSignal.timeout(KAKAO_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!tokenRes.ok) return null;
    const accessToken = parseKakaoToken(await tokenRes.json());
    if (!accessToken) return null;

    const meRes = await fetch(KAKAO_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(KAKAO_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!meRes.ok) return null;
    return parseKakaoId(await meRes.json());
  } catch {
    // 시간 초과 · 네트워크 오류. 로그인 화면에서 다시 시도하게 한다.
    return null;
  }
}
