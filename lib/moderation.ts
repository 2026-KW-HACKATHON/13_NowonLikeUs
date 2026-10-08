/*
 * 운영자 정리(질문 삭제 · 답변 숨김) 입력 검증. 서버 코드를 import 하지 않는다 — 화면도 같은 함수를 쓸 수 있다.
 */

import type { QuestionStatus } from './types';

export type HideAnswerValidation = { ok: true; value: { isHidden: boolean } } | { ok: false; error: string };

/** PATCH /api/admin/answers/[id] 본문. `{ isHidden: true | false }` 만 받는다. */
export function validateHideAnswer(input: unknown): HideAnswerValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  }
  const { isHidden } = input as Record<string, unknown>;
  if (typeof isHidden !== 'boolean') return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  return { ok: true, value: { isHidden } };
}

/**
 * 지울 수 있는 질문인가. 할 일로 정리된(PROMOTED) 질문은 발행된 할 일이 출처로 가리키고 있어 지우지 않는다.
 * 화면은 이 값으로 "질문 지우기" 버튼을 띄울지 정한다. 서버도 같은 조건으로 막는다(409).
 */
export function canDeleteQuestion(status: QuestionStatus): boolean {
  return status !== 'PROMOTED';
}
