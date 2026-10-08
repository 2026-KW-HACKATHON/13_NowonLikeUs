import type { Confidence } from '@/lib/types';

/**
 * AI 답변의 근거 신뢰도 배지. 문구는 설계안 3.1 그대로다.
 *
 * 색만으로 구분하지 않는다. 기호와 글자가 항상 같이 붙어서, 색각 이상이 있거나
 * 흑백으로 인쇄해도 세 상태가 구분된다. 기호는 장식이라 스크린리더에는 읽히지 않는다.
 */
const BADGE: Record<Confidence, { mark: string; label: string }> = {
  GROUNDED: { mark: '✓', label: '월계1동에서 확인된 정보' },
  PARTIAL: { mark: '!', label: '일부만 확인됨' },
  UNKNOWN: { mark: '?', label: '아직 아무도 확인하지 않았습니다' },
};

export default function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { mark, label } = BADGE[confidence];
  return (
    <span className={`conf conf--${confidence.toLowerCase()}`}>
      <span className="conf__mark" aria-hidden="true">
        {mark}
      </span>
      {label}
    </span>
  );
}
