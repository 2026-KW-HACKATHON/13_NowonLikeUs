/**
 * 질문에 흔히 붙지만 할 일을 가리키지 않는 표현. 조사를 뗀 형태와 원형 둘 다 비교한다.
 * "해야"처럼 설명 문장에 자주 나오는 말이 걸려 엉뚱한 카드가 나오는 것을 막는다.
 */
const STOPWORDS = new Set([
  '언제', '어디', '어디서', '어디로', '어떻게', '어떤', '무엇', '뭐', '뭘', '왜', '누가', '얼마', '얼마나', '몇',
  '해야', '해야해요', '해야하나요', '하나요', '해요', '하면', '하려면', '하는', '할', '돼', '돼요', '되나요', '되면',
  '있나요', '있어요', '없나요', '받아야', '받는', '받으려면', '곳', '것', '거', '때',
  '알려줘', '알려주세요', '궁금해요', '좀', '혹시', '저', '제가', '저는', '나', '내가', '일', '무슨',
]);

const PARTICLE = '(으로|에서|에게|한테|부터|까지|처럼|보다|은|는|이|가|을|를|에|로|와|과|도|만)';

/** 조사를 떼어 비교할 한 글자 불용어. "뭐부터", "곳은"도 거른다. 나·저는 "나가"처럼 다른 낱말과 겹쳐 뺀다. */
const SHORT_STOPWORDS = new RegExp(`^(뭐|곳|것|거|때|몇|일)${PARTICLE}$`, 'u');

/**
 * 동사·형용사 활용형으로 끝나는 말. "지키려면", "버려요"처럼 질문의 서술부라 카드 문구와 잘 맞지 않는다.
 * 점수에는 그대로 쓰지만, 제목 규칙을 적용할지 정하는 키워드 수에서는 뺀다.
 */
const PREDICATE = /(려면|으면|하면|려고|는데|니까|야|요|까)$/u;

/**
 * Gemini 호출 실패 시 사용할 키워드 검색.
 * 서로 다른 키워드의 부분 문자열 일치 수로 정렬하며 원본 데이터는 수정하지 않는다.
 * 의미 있는 키워드가 둘 이상인 질문에서 하나만 걸린 항목은 제목에 걸렸을 때만 인정한다.
 * 서술부("지키려면")와 한 글자 키워드는 의미 있는 키워드 수에 넣지 않는다.
 * 두 글자 이상 키워드의 일치 수로 먼저 정렬하고, 같으면 제목에 걸린 키워드가 많은 항목을 먼저 둔다.
 * 한 글자 키워드는 혼자서 항목을 찾지 못하고, 일치는 마지막 동점 처리에만 쓴다.
 * 결과는 관련 항목 후보일 뿐, 답변의 근거나 신뢰도를 확정하지 않는다.
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

  const keywords = [...new Set(normalizedQuery.split(/\s+/)
    .map((word) => word.replace(/^\p{P}+|\p{P}+$/gu, ''))
    .filter(Boolean))].map((word) => ({
    word,
    stem: word.replace(new RegExp(`^([가-힣]{2,}?)${PARTICLE}$`, 'u'), '$1'),
  })).filter(({ word, stem }) => !STOPWORDS.has(word) && !STOPWORDS.has(stem) && !SHORT_STOPWORDS.test(word));

  // 서술부와 한 글자 키워드는 뜻이 약해 "키워드가 둘 이상인 질문"을 판단할 때 세지 않는다.
  const meaningfulCount = new Set(keywords
    .filter(({ word, stem }) => stem.length > 1 && !PREDICATE.test(word))
    .map(({ stem }) => stem)).size;

  const matchedStems = (field: string, minLength = 1) => new Set(keywords.filter(({ word, stem }) =>
    stem.length >= minLength && (field.includes(word) || field.includes(stem)),
  ).map(({ stem }) => stem));

  return items
    .map((item) => {
      const title = item.title.toLowerCase();
      const text = [title, item.why.toLowerCase(), item.howTo.toLowerCase()].join('\n');
      const score = matchedStems(text).size;
      const strongScore = matchedStems(text, 2).size;
      // 한 글자 키워드는 "일"이 "확정일자"에 걸리듯 우연히 겹치기 쉬워 제목 점수에서 뺀다.
      const titleScore = matchedStems(title, 2).size;

      return { item, score, strongScore, titleScore };
    })
    // 인정 여부는 두 글자 이상 키워드로만 정한다. 하나만 걸렸으면 의미 있는 키워드가 하나뿐인 질문이거나 제목에 걸려야 한다.
    .filter(({ strongScore, titleScore }) => strongScore > 1 || (strongScore === 1 && (meaningfulCount <= 1 || titleScore > 0)))
    .sort((a, b) => b.strongScore - a.strongScore || b.titleScore - a.titleScore || b.score - a.score)
    .slice(0, Math.floor(limit))
    .map(({ item }) => item);
}
