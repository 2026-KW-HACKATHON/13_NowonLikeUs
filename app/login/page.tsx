import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import Masthead from '@/components/Masthead';
import { safeNext } from '@/lib/authView';

export const metadata = { title: '로그인 · 월계는 처음이라' };

/**
 * 로그인.
 *
 * 할 일 목록 · 질문은 로그인 없이 쓴다 (설계안 2.1). 로그인은 답변을 다는 사람과 운영자만 한다.
 * `?next=` 는 서버에서 검사해서 이 사이트 안 경로만 넘긴다.
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const next = safeNext((await searchParams).next);

  return (
    <main>
      <Masthead profile={null} account={false} />
      <Link href="/tasks" className="back">
        ← 내 할 일
      </Link>

      <h1 className="page-title">로그인</h1>
      <p className="lead">다음 사람의 질문에 답하려면 로그인이 필요합니다. 할 일 보기와 질문은 로그인 없이 됩니다.</p>

      <AuthForm mode="login" next={next} />
    </main>
  );
}
