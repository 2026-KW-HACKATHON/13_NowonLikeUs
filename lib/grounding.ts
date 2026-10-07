import type { Confidence } from "@/lib/types";

export interface GroundingResult {
  confidence: Confidence;
  validSourceIds: string[];
  droppedSourceIds: string[];
}

export type GroundedAnswer = Omit<GroundingResult, "confidence"> &
  (
    | { confidence: "UNKNOWN"; answer: null }
    | { confidence: Exclude<Confidence, "UNKNOWN">; answer: string }
  );

const SAFE_GUIDANCE = "관련 항목의 원문 카드를 확인해 주세요.";

/**
 * /api/ask의 응답 및 aiAnswer 저장에는 AI가 고른 근거를 검증한 이 결과를 사용한다.
 * 서버가 근거 ID와 신뢰도를 검증한 뒤 고정 안내만 생성한다.
 */
export function groundAnswer(
  ai: { sourceIds: string[]; confidence: Confidence },
  known: Set<string>,
): GroundedAnswer {
  const result = verifyGrounding(ai.sourceIds, known, ai.confidence);

  if (result.confidence === "UNKNOWN") {
    return {
      ...result,
      confidence: "UNKNOWN",
      answer: null,
      validSourceIds: [],
    };
  }

  return { ...result, confidence: result.confidence, answer: SAFE_GUIDANCE };
}

/**
 * AI가 제시한 근거 ID를 실제 지식 ID와 대조하고,
 * 서버가 검증할 수 있는 범위까지만 신뢰한다.
 */
export function verifyGrounding(
  claimed: string[],
  known: Set<string>,
  aiConfidence: Confidence,
): GroundingResult {
  const uniqueSourceIds = [...new Set(claimed.map((id) =>
    known.has(id) || !known.has(`task:${id}`) ? id : `task:${id}`,
  ))];
  const validSourceIds = uniqueSourceIds.filter((id) => known.has(id));
  const droppedSourceIds = uniqueSourceIds.filter((id) => !known.has(id));

  if (aiConfidence === "UNKNOWN") {
    return {
      confidence: "UNKNOWN",
      validSourceIds: [],
      droppedSourceIds,
    };
  }

  if (validSourceIds.length === 0) {
    return {
      confidence: "UNKNOWN",
      validSourceIds: [],
      droppedSourceIds,
    };
  }

  if (aiConfidence === "PARTIAL" || droppedSourceIds.length > 0) {
    return {
      confidence: "PARTIAL",
      validSourceIds,
      droppedSourceIds,
    };
  }

  return {
    confidence: "GROUNDED",
    validSourceIds,
    droppedSourceIds,
  };
}
