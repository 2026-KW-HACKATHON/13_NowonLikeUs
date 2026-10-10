import { CONTRACT_LABEL, HOUSING_LABEL } from './labels';
import type { AnswerItem, ConfirmAnswerResponse, QuestionItem, QuestionStatus } from './types';

/*
 * 질문 목록 화면(/questions)의 판정 로직. 서버 응답을 화면 상태에 반영하는 규칙을 여기 모아 테스트한다.
 */

/** 질문 목록의 탭. 상태별 셋에 더해, 로그인한 사람에게만 "내 질문"(MINE)이 보인다. */
export type BoardTab = QuestionStatus | 'MINE';

export const QUESTION_TABS: readonly { status: BoardTab; label: string; empty: string }[] = [
  {
    status: 'MINE',
    label: '내 질문',
    empty: '아직 이웃에게 넘어간 내 질문이 없습니다. 확인된 정보로 답하지 못했거나 "이웃에게 물어보기"를 누른 질문이 여기 모입니다.',
  },
  { status: 'OPEN', label: '답을 기다려요', empty: '지금은 답을 기다리는 질문이 없습니다.' },
  { status: 'ANSWERED', label: '답이 달렸어요', empty: '아직 답이 달린 질문이 없습니다.' },
  { status: 'PROMOTED', label: '할 일이 됐어요', empty: '아직 할 일로 정리된 질문이 없습니다.' },
];

/**
 * `?status=` 를 탭으로. 모르는 값이면 답을 기다리는 질문부터 보여준다 — 이 화면에 온 이유가 그것이다.
 * "내 질문"은 로그인했을 때만 연다. 비로그인이면 탭이 없으니 답을 기다리는 질문으로 돌린다.
 */
export function parseTab(raw: string | string[] | undefined, loggedIn = false): BoardTab {
  if (raw === 'MINE') return loggedIn ? 'MINE' : 'OPEN';
  return QUESTION_TABS.some((tab) => tab.status === raw) ? (raw as QuestionStatus) : 'OPEN';
}

/** 화면에 띄울 탭. "내 질문"은 로그인한 사람에게만. */
export function visibleTabs(loggedIn: boolean) {
  return QUESTION_TABS.filter((tab) => loggedIn || tab.status !== 'MINE');
}

/** 탭별로 부를 목록 주소. "내 질문"은 상태를 섞어 한 번에 받는다. */
export function boardUrl(tab: BoardTab): string {
  return tab === 'MINE' ? '/api/questions?mine=1' : `/api/questions?status=${tab}`;
}

/**
 * "내 질문" 카드 위에 붙일 상태 글자. 상태가 섞여 있어서 지금 어디까지 왔는지 알려 준다.
 * 할 일로 정리된 질문은 카드가 이미 "할 일로 정리됨"을 붙이므로 여기서는 null.
 */
export function mineStateLabel(status: QuestionStatus): string | null {
  if (status === 'OPEN') return '답을 기다려요';
  if (status === 'ANSWERED') return '답이 달렸어요';
  return null;
}

/**
 * 답변을 단 직후의 목록. 서버가 돌려준 답변을 뒤에 붙인다(서버도 오래된 순).
 * 첫 답변이면 서버에서 OPEN → ANSWERED 가 됐으므로 화면도 맞춘다.
 * "답을 기다려요" 탭에서도 바로 빼지 않는다 — 방금 쓴 답이 사라지면 저장이 안 된 줄 안다.
 */
export function withAnswer(questions: QuestionItem[], questionId: string, answer: AnswerItem): QuestionItem[] {
  return questions.map((q) =>
    q.id !== questionId
      ? q
      : {
          ...q,
          status: q.status === 'OPEN' ? 'ANSWERED' : q.status,
          answers: [...q.answers.filter((a) => a.id !== answer.id), answer],
        },
  );
}

/** "맞아요" 직후의 목록. 개수는 서버가 다시 센 값을 그대로 쓴다(내가 +1 하지 않는다). */
export function withConfirm(questions: QuestionItem[], answerId: string, res: ConfirmAnswerResponse): QuestionItem[] {
  return questions.map((q) =>
    q.answers.some((a) => a.id === answerId)
      ? {
          ...q,
          answers: q.answers.map((a) =>
            a.id === answerId ? { ...a, confirmationCount: res.confirmationCount, confirmedByMe: res.confirmedByMe } : a,
          ),
        }
      : q,
  );
}

/** "원룸 · 월세 사는 분의 질문" — 답하는 사람이 상황을 알고 답하게. 둘 다 없으면 null. */
export function askerContext(q: Pick<QuestionItem, 'ctxHousingType' | 'ctxContractType'>): string | null {
  const parts = [
    q.ctxHousingType ? HOUSING_LABEL[q.ctxHousingType] : null,
    q.ctxContractType ? CONTRACT_LABEL[q.ctxContractType] : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? `${parts.join(' · ')} 사는 분의 질문` : null;
}

/**
 * "3분 전" 같은 시각 표시. 일주일이 넘으면 날짜로 쓴다.
 * 날짜 경계는 한국 시간 기준이다 — 서버 시간대와 상관없이 같은 글자가 나와야 한다.
 */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const kst = new Date(then.getTime() + 9 * 60 * 60_000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

/** 질문 아래에 무엇을 보여줄지. 승격된 질문에는 더 답할 수 없다(서버도 409). */
export function answerSlot(
  status: QuestionStatus,
  session: { loaded: boolean; loggedIn: boolean },
): 'closed' | 'pending' | 'login' | 'form' {
  if (status === 'PROMOTED') return 'closed';
  if (!session.loaded) return 'pending';
  return session.loggedIn ? 'form' : 'login';
}

/**
 * 답변 옆 "맞아요" 자리에 버튼을 둘지, 개수만 둘지.
 *
 * - 로그인 안 했으면 개수만 (누르려면 로그인 — 답변 칸의 "로그인하고 답하기"가 안내한다)
 * - 할 일로 정리된 질문이면 개수만 (확인 수가 더는 쓰일 곳이 없다)
 * - 내가 쓴 답변이면 개수만 (서버도 403). 닉네임은 겹칠 수 있어 서버가 준 authoredByMe 로만 판단한다
 */
export function confirmSlot(
  answer: Pick<AnswerItem, 'authoredByMe'>,
  context: { loggedIn: boolean; status: QuestionStatus },
): 'button' | 'count' {
  if (!context.loggedIn || context.status === 'PROMOTED' || answer.authoredByMe) return 'count';
  return 'button';
}

/* ---------- 운영자 정리 (질문 지우기 · 답변 숨기기) ---------- */

/** 운영자 정리 버튼을 보일 사람인가. 서버도 role 을 DB 에서 다시 읽어 막으므로 화면 판정은 버튼 노출용이다. */
export function isModerator(user: { role: string } | null): boolean {
  return user?.role === 'ADMIN';
}

/** 질문을 지운 직후의 목록. */
export function withoutQuestion(questions: QuestionItem[], questionId: string): QuestionItem[] {
  return questions.filter((q) => q.id !== questionId);
}

/**
 * 답변을 숨긴 직후의 목록. 질문 상태는 서버가 다시 맞춘 값을 그대로 쓴다
 * (보이는 답변이 없어지면 ANSWERED → OPEN).
 */
export function withAnswerHidden(
  questions: QuestionItem[],
  answerId: string,
  questionStatus: QuestionStatus,
): QuestionItem[] {
  return questions.map((q) =>
    q.answers.some((a) => a.id === answerId)
      ? { ...q, status: questionStatus, answers: q.answers.filter((a) => a.id !== answerId) }
      : q,
  );
}

/** 숨긴 답변을 되돌린 직후의 목록. 서버 순서(오래된 순)에 맞춰 제자리에 다시 넣는다. */
export function withAnswerRestored(
  questions: QuestionItem[],
  answer: AnswerItem,
  questionStatus: QuestionStatus,
): QuestionItem[] {
  return questions.map((q) =>
    q.id !== answer.questionId
      ? q
      : {
          ...q,
          status: questionStatus,
          answers: [...q.answers.filter((a) => a.id !== answer.id), answer].sort((x, y) =>
            x.createdAt.localeCompare(y.createdAt),
          ),
        },
  );
}
