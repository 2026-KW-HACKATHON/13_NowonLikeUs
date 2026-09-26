import type { Confidence } from '@/lib/types';

export interface GroundingResult {
  confidence: Confidence;
  validSourceIds: string[];
  droppedSourceIds: string[];
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
