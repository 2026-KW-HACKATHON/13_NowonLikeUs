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

/** 수치가 든 AI 문장은 폐기한다. DB 원문 카드에는 적용하지 않는다. */
export function hasNumericContent(answer: string): boolean {
  const text = answer.normalize('NFKC').replace(/\p{Cf}/gu, '');
  // ponytail: 한글 수량 표현은 보수적인 패턴 검사다. 모든 자연어 수치를 판별하지는 못한다.
  return /\p{N}/u.test(text)
    || /(?:^|[^가-힣])(?:[영공일이삼사오육칠팔구십백천만억조]+|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무)\s*(?:개월|시간|퍼센트|만원|원|년|월|일|주|달|시|분|초|번|개|명|층|호|평|미터)/u.test(text)
    || /(?:^|[^가-힣])(?:하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레|열흘)/u.test(text);
}

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

  if (result.confidence === 'UNKNOWN' || hasNumericContent(ai.answer)) {
    return { ...result, confidence: 'UNKNOWN', answer: null, validSourceIds: [] };
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
