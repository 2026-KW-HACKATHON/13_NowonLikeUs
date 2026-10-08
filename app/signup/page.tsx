import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import Masthead from '@/components/Masthead';
import { safeNext } from '@/lib/authView';

export const metadata = { title: '가입 · 월계는 처음이라' };

/** 가입. 가입하면 항상 일반 회원이다 — 운영자는 서버에서만 만든다. */
export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const next = safeNext((await searchParams).next);

  return (
    <main>
      <Masthead profile={null} account={false} />
      <Link href="/tasks" className="back">
        ← 내 할 일
      </Link>

      <h1 className="page-title">가입하기</h1>
      <p className="lead">먼저 와 본 사람의 답이 다음 사람의 할 일이 됩니다. 이메일은 로그인에만 쓰고 화면에는 보이지 않습니다.</p>

      <AuthForm mode="signup" next={next} />

      <p className="note">
        상세 주소 · 연락처는 받지 않습니다. 답변에는 닉네임만 표시됩니다.
      </p>
    </main>
  );
}
