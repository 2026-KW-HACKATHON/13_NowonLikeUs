/**
 * Gemini 호출 실패 시 사용할 키워드 검색.
 * 서로 다른 키워드의 부분 문자열 일치 수로 정렬하며 원본 데이터는 수정하지 않는다.
 * 결과는 관련 항목 후보일 뿐, 답변의 근거나 신뢰도를 확정하지 않는다.
 * ponytail: 부분 문자열 검색이라 조사·동의어를 처리하지 않는다. 검색 누락이 확인되면 정규화를 추가한다.
 */
export function keywordSearch<
  T extends { title: string; why: string; howTo: string },
>(items: T[], query: string, limit = 3): T[] {
  if (!Number.isFinite(limit) || limit < 1) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const keywords = [...new Set(normalizedQuery.split(/\s+/))];

  return items
    .map((item) => {
      const fields = [item.title, item.why, item.howTo].map((field) =>
        field.toLowerCase(),
      );
      const score = keywords.filter((keyword) =>
        fields.some((field) => field.includes(keyword)),
      ).length;

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.floor(limit))
    .map(({ item }) => item);
}
