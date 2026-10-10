import { redirect } from 'next/navigation';
import KakaoSignupForm from '@/components/KakaoSignupForm';
import Masthead from '@/components/Masthead';
import { readKakaoPending } from '@/lib/auth';

export const metadata = { title: '닉네임 정하기 · 월계는 처음이라' };

/**
 * 카카오로 처음 로그인한 사람이 이 서비스에서 쓸 닉네임을 정하는 화면.
 * 카카오 닉네임은 실명인 경우가 많아 받지 않는다. 답변 옆에 보일 이름은 여기서 새로 정한다.
 * 콜백이 서명해 둔 쿠키(10분)가 없으면 카카오 로그인부터 다시 하게 한다.
 */
export default async function KakaoSignupPage() {
  const pending = await readKakaoPending();
  if (!pending) redirect('/login?kakao=failed');

  return (
    <main>
      <Masthead profile={null} account={false} />

      <h1 className="page-title">닉네임 정하기</h1>
      <p className="lead">카카오로 처음 오셨네요. 답변 옆에 보일 닉네임을 정해 주세요. 카카오 이름은 쓰지 않습니다.</p>

      <KakaoSignupForm />

      <p className="note">카카오에서는 회원번호만 받습니다. 이메일 · 전화번호 · 상세 주소는 받지 않습니다.</p>
    </main>
  );
}
