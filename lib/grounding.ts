import type { Confidence } from '@/lib/types';

export interface GroundingResult {
  confidence: Confidence;
  validSourceIds: string[];
  droppedSourceIds: string[];
}

export type GroundedAnswer = Omit<GroundingResult, 'confidence'> & (
  | { confidence: 'UNKNOWN'; answer: null }
  | { confidence: Exclude<Confidence, 'UNKNOWN'>; answer: string }
);

/**
 * /api/ask의 응답 및 aiAnswer 저장에는 AI 원문 대신 이 결과를 사용한다.
 * AI의 자기 평가가 아닌 서버 검증 후 신뢰도를 기준으로 답변을 차단한다.
 * 이 함수는 근거 ID의 존재만 검증하며, 답변 내용의 정확성을 보장하지 않는다.
 */
export function groundAnswer(
  ai: { answer: string; sourceIds: string[]; confidence: Confidence },
  known: Set<string>,
): GroundedAnswer {
  const result = verifyGrounding(ai.sourceIds, known, ai.confidence);

  if (result.confidence === 'UNKNOWN') {
    return { ...result, confidence: 'UNKNOWN', answer: null };
  }

  return { ...result, confidence: result.confidence, answer: ai.answer };
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
  const uniqueSourceIds = [...new Set(claimed)];
  const validSourceIds = uniqueSourceIds.filter((id) => known.has(id));
  const droppedSourceIds = uniqueSourceIds.filter((id) => !known.has(id));

  if (aiConfidence === 'UNKNOWN') {
    return {
      confidence: 'UNKNOWN',
      validSourceIds: [],
      droppedSourceIds,
    };
  }

  if (validSourceIds.length === 0) {
    return {
      confidence: 'UNKNOWN',
      validSourceIds: [],
      droppedSourceIds,
    };
  }

  if (aiConfidence === 'PARTIAL' || droppedSourceIds.length > 0) {
    return {
      confidence: 'PARTIAL',
      validSourceIds,
      droppedSourceIds,
    };
  }

  return {
    confidence: 'GROUNDED',
    validSourceIds,
    droppedSourceIds,
  };
}
