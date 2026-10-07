/*
 * 답변 입력 검증. 서버 코드를 import 하지 않는다 — 화면도 ANSWER_MAX 를 같은 상수에서 가져간다.
 */

/** 답변 본문 한도(앞뒤 공백을 지운 뒤 센다) */
export const ANSWER_MAX = 500;

export type AnswerValidation = { ok: true; value: { text: string } } | { ok: false; error: string };

/** 답변 본문 검증. 앞뒤 공백을 지우고 1~500자. 한글도 한 글자로 센다. */
export function validateAnswer(input: unknown): AnswerValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  }
  const { text } = input as Record<string, unknown>;
  if (typeof text !== 'string') return { ok: false, error: '요청 형식이 올바르지 않습니다.' };

  const trimmed = text.trim();
  const length = [...trimmed].length;
  if (length === 0) return { ok: false, error: '답변을 입력해 주세요.' };
  if (length > ANSWER_MAX) return { ok: false, error: `답변은 ${ANSWER_MAX}자 이하로 입력해 주세요.` };
  return { ok: true, value: { text: trimmed } };
}
