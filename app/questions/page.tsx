import Link from 'next/link';
import Masthead from '@/components/Masthead';
import QuestionBoard from '@/components/QuestionBoard';
import { QUESTION_TABS, parseTab } from '@/lib/questionBoard';

export const metadata = { title: '이웃의 질문 · 월계는 처음이라' };

/**
 * 이웃의 질문. 확인된 정보로 답하지 못한 질문과, 확인된 답이 원하던 답이 아니어서
 * 질문자가 이웃에게 넘긴 질문에 먼저 와 본 주민이 답하는 곳.
 *
 * 보기는 로그인 없이 된다. 답변 · "맞아요"만 로그인이 필요하다 (설계안 2.1).
 * 탭은 링크라서 주소로 바로 열 수 있고 뒤로 가기가 탭 단위로 동작한다.
 */
export default async function QuestionsPage({ searchParams }: PageProps<'/questions'>) {
  const status = parseTab((await searchParams).status);

  return (
    <main>
      {/* 상황 정보는 이 화면에서 쓰지 않는다. 질문은 상황과 상관없이 모두에게 보인다. */}
      <Masthead profile={null} />

      <h1 className="page-title">이웃의 질문</h1>
      <p className="lead">
        확인된 정보로 답하지 못했거나, 안내받은 답이 원하던 답이 아니었던 질문입니다. 먼저 와 본 경험으로 답해
        주세요. 운영자가 확인한 답은 다음 사람의 할 일이 됩니다.
      </p>

      <nav className="tabs" aria-label="질문 상태">
        {QUESTION_TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/questions?status=${tab.status}`}
            className="tabs__item"
            aria-current={tab.status === status ? 'page' : undefined}
            scroll={false}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <QuestionBoard key={status} status={status} />

      <p className="asof">
        주민 답변은 운영자가 확인하기 전 정보입니다. 기한 · 금액 · 장소는 할 일 목록의 원문이나 주민센터로 확인하세요.
      </p>
    </main>
  );
}
