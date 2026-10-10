import { kakaoErrorMessage, kakaoStartHref } from '@/lib/authView';

/**
 * 로그인 · 가입 화면 맨 위의 카카오 버튼과, 카카오에서 실패하고 돌아왔을 때의 안내.
 *
 * 버튼은 카카오 디자인 가이드를 따른다 — 노란 바탕(#FEE500), 검정 말풍선, 85% 검정 글자.
 * 카카오 로그인은 페이지 이동(서버 리다이렉트)이라 버튼이 아니라 링크다.
 * 서버에 카카오 키가 없으면(`enabled` false) 버튼을 띄우지 않는다.
 */
export default function KakaoLogin({
  enabled,
  next,
  label,
  error,
}: {
  enabled: boolean;
  next: string;
  label: string;
  error: string | string[] | undefined;
}) {
  const message = kakaoErrorMessage(error);

  return (
    <>
      {message && (
        <p className="warn kakao-error" role="alert">
          {message}
        </p>
      )}
      {enabled && (
        <>
          <a className="kakao-button" href={kakaoStartHref(next)}>
            <svg className="kakao-button__symbol" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.87 5.3 4.69 6.7-.2.75-.74 2.72-.85 3.14-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.53.66.1 1.33.15 2.02.15 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
            </svg>
            {label}
          </a>
          <p className="kakao-note">카카오에서는 회원번호만 받습니다. 이메일 · 전화번호는 받지 않습니다.</p>
          <p className="auth-divider">
            <span>또는 이메일로</span>
          </p>
        </>
      )}
    </>
  );
}
