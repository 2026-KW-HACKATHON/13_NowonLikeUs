/**
 * 질문에 흔히 붙지만 할 일을 가리키지 않는 표현. 조사를 뗀 형태와 원형 둘 다 비교한다.
 * "해야"처럼 설명 문장에 자주 나오는 말이 걸려 엉뚱한 카드가 나오는 것을 막는다.
 */
const STOPWORDS = new Set([
  '언제', '어디', '어디서', '어디로', '어떻게', '어떤', '무엇', '뭐', '뭘', '왜', '누가', '얼마', '얼마나', '몇',
  '해야', '해야해요', '해야하나요', '하나요', '해요', '하면', '하려면', '하는', '할', '돼', '돼요', '되나요', '되면',
  '있나요', '있어요', '없나요', '받아야', '받는', '받으려면', '곳', '것', '거', '때',
  '알려줘', '알려주세요', '궁금해요', '좀', '혹시', '저', '제가', '저는', '나', '내가', '일', '무슨',
  // "버리는 방법 알아두기"처럼 카드 제목에 흔해, 이 말 하나로 관계없는 카드가 걸리는 것을 막는다.
  '방법',
]);

const PARTICLE = '(으로|에서|에게|한테|부터|까지|처럼|보다|은|는|이|가|을|를|에|로|와|과|도|만)';

/** 조사를 떼어 비교할 한 글자 불용어. "뭐부터", "곳은"도 거른다. 나·저는 "나가"처럼 다른 낱말과 겹쳐 뺀다. */
const SHORT_STOPWORDS = new RegExp(`^(뭐|곳|것|거|때|몇|일)${PARTICLE}$`, 'u');

/**
 * "버리는", "버리기", "버려요" 같은 버리다 활용형. 쓰레기 카드 제목 대부분에 있어 어느 카드인지 가려 주지 못하고,
 * "쓰레기 버리는 날"에 대형폐기물 카드가 섞이게 한다. 다른 키워드로 찾은 결과가 없을 때만 키워드로 쓴다.
 * 버리는 질문인지 판단에는 계속 쓴다.
 */
const DISPOSAL_VERB = /^버(리|려|릴|린|림)/u;

/**
 * 동사·형용사 활용형으로 끝나는 말. "지키려면", "버려요"처럼 질문의 서술부라 카드 문구와 잘 맞지 않는다.
 * 점수에는 그대로 쓰지만, 제목 규칙을 적용할지 정하는 키워드 수에서는 뺀다.
 */
const PREDICATE = /(려면|으면|하면|려고|는데|니까|야|요|까)$/u;

/**
 * 질문 어디에 있어도 버리는 뜻인 표현. 띄어쓰기를 뺀 질문에서 찾는다("내다 놓기" → "내다놓기").
 * "정리"는 "옷장 정리"처럼 버리는 뜻이 아닐 때가 많아 넣지 않는다.
 */
const CLEAR_DISPOSAL = /버리|버려|버릴|버린|버림|폐기|배출|수거|회수|처분|재활용|내놓|내다놓/u;

/**
 * 버리는 뜻과 청소 뜻이 섞이는 표현. "소파 치우기"는 버리기지만 "소파 먼지 치우기"는 청소다.
 * 그래서 대상 바로 뒤(조사·띄어쓰기만 허용)에 올 때만 버리는 질문으로 본다.
 */
const AMBIGUOUS_DISPOSAL = '(치우|치워|치울|없애|없앨|처리)';

/**
 * 질문에 이 표현이 있으면 카드에 쓰인 말을 키워드로 하나 더 넣는다.
 * "쓰레기 봉투"처럼 띄어 써서 두 낱말로 갈라지는 말도 붙여 쓴 것과 똑같이 잇는다.
 */
const PHRASE_KEYWORDS: [RegExp, string][] = [
  [/쓰레기\s*봉투/u, '종량제봉투'],
];

interface SynonymGroup {
  words: string[];
  expanded: string[];
  /** 그 낱말을 버리는 질문일 때만 넓힌다. 카드가 버리는 방법만 안내할 때 쓴다. */
  disposalOnly?: boolean;
}

/**
 * 질문에 쓰는 말과 카드에 쓰인 말이 다른 경우의 동의어. 질문 키워드를 넓히는 데만 쓴다.
 * 넓힌 말이 걸려도 원래 키워드 하나로 센다. "소파 버리기"가 "대형폐기물" 카드를 찾게 한다.
 * 가구·소형 가전 카드는 버리는 방법만 안내하므로 버리는 질문에서만 넓힌다("소파 청소"는 넓히지 않는다).
 * 소형 가전은 카드에 품목으로 적힌 것만 넣는다.
 */
const SYNONYM_GROUPS: SynonymGroup[] = [
  { words: ['소파', '쇼파', '침대', '책상', '옷장', '매트리스'], expanded: ['가구', '대형폐기물'], disposalOnly: true },
  { words: ['전자레인지', '드라이기'], expanded: ['작은 가전'], disposalOnly: true },
  { words: ['분리수거'], expanded: ['분리배출', '재활용'] },
  // 아파트 카드는 "분리배출"로, 일반주택 카드는 "재활용"과 품목 이름으로 적혀 있다.
  { words: ['재활용'], expanded: ['분리배출'] },
  { words: ['페트병', '비닐', '스티로폼', '플라스틱', '박스'], expanded: ['재활용', '분리배출'] },
  { words: ['강아지', '애완견'], expanded: ['반려견'] },
];

const SYNONYMS = new Map(SYNONYM_GROUPS.flatMap((group) => group.words.map((word) => [word, group] as const)));

/**
 * 시드에 검증된 안내 카드가 없는 대형 가전. 띄어쓰기를 뺀 질문에 있으면 버리는 표현이 없어도 빈 결과를 돌려준다.
 * 폐기 표현 목록으로 거르면 "식기세척기 버리는 법", "에어컨 철거"처럼 다른 말로 물을 때 빠져나가
 * 처리 방법이 다른 생활쓰레기·작은 가전·대형폐기물 카드를 안내하게 된다.
 * 다른 주제와 함께 물어도 빈 결과가 되지만, 확인되지 않은 처리 방법을 보여주는 것보다 낫다.
 * 검증된 대형 폐가전 카드가 시드에 생기면 이 규칙 대신 그 카드로 잇는다.
 */
const UNVERIFIED_LARGE_APPLIANCE =
  /냉장고|냉동고|세탁기|건조기|에어컨|텔레비전|텔레비젼|티비|티브이|tv|식기세척기|정수기|안마의자|대형가전|대형폐가전|큰가전/u;

/**
 * Gemini 호출 실패 시 사용할 키워드 검색.
 * 서로 다른 키워드의 부분 문자열 일치 수로 정렬하며 원본 데이터는 수정하지 않는다.
 * 의미 있는 키워드가 둘 이상인 질문에서 하나만 걸린 항목은 제목에 걸렸을 때만 인정한다.
 * 서술부("지키려면")와 한 글자 키워드는 의미 있는 키워드 수에 넣지 않는다.
 * 두 글자 이상 키워드의 일치 수로 먼저 정렬하고, 같으면 제목에 걸린 키워드가 많은 항목을 먼저 둔다.
 * 한 글자 키워드는 혼자서 항목을 찾지 못하고, 일치는 마지막 동점 처리에만 쓴다.
 * 질문 키워드는 동의어로 넓히고, 검증된 카드가 없는 대형 가전 질문은 빈 결과로 둔다.
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

  const compactQuery = normalizedQuery.replace(/\s+/gu, '');
  if (UNVERIFIED_LARGE_APPLIANCE.test(compactQuery)) {
    return [];
  }

  // 동의어 표의 낱말만 정규식에 넣으므로 이스케이프가 필요 없다.
  const isDisposalOf = (word: string) => CLEAR_DISPOSAL.test(compactQuery)
    || new RegExp(`${word}${PARTICLE}?\\s*${AMBIGUOUS_DISPOSAL}`, 'u').test(normalizedQuery);

  const synonymsOf = (word: string): string[] => {
    const group = SYNONYMS.get(word);
    return group && (!group.disposalOnly || isDisposalOf(word)) ? group.expanded : [];
  };

  // "전입신고,확정일자"처럼 띄어 쓰지 않은 나열도 나눈다.
  const keywords = [...new Set(normalizedQuery.split(/[\s,·]+/u)
    .map((word) => word.replace(/^\p{P}+|\p{P}+$/gu, ''))
    .filter(Boolean))].map((word) => ({
    word,
    stem: word.replace(new RegExp(`^([가-힣]{2,}?)${PARTICLE}$`, 'u'), '$1'),
  })).filter(({ word, stem }) => !STOPWORDS.has(word) && !STOPWORDS.has(stem) && !SHORT_STOPWORDS.test(word))
    .map((keyword) => ({
      ...keyword,
      forms: [keyword.word, keyword.stem, ...synonymsOf(SYNONYMS.has(keyword.stem) ? keyword.stem : keyword.word)],
      weak: DISPOSAL_VERB.test(keyword.stem),
    }))
    .concat(PHRASE_KEYWORDS
      .filter(([pattern]) => pattern.test(normalizedQuery))
      .map(([, word]) => ({ word, stem: word, forms: [word], weak: false })));

  // "버리는" 없이 먼저 찾고, 아무것도 없을 때만 넣어서 다시 찾는다.
  // 기숙사처럼 쓰레기 카드가 하나뿐인 경우 "비닐 버리는 요일"이 그 카드를 계속 찾게 한다.
  const strongKeywords = keywords.filter(({ weak }) => !weak);
  const result = rankItems(items, strongKeywords, limit);
  return result.length > 0 || strongKeywords.length === keywords.length ? result : rankItems(items, keywords, limit);
}

function rankItems<T extends { title: string; why: string; howTo: string }>(
  items: T[],
  keywords: { word: string; stem: string; forms: string[] }[],
  limit: number,
): T[] {
  // 서술부와 한 글자 키워드는 뜻이 약해 "키워드가 둘 이상인 질문"을 판단할 때 세지 않는다.
  const meaningfulCount = new Set(keywords
    .filter(({ word, stem }) => stem.length > 1 && !PREDICATE.test(word))
    .map(({ stem }) => stem)).size;

  const matchedStems = (field: string, minLength = 1) => new Set(keywords.filter(({ stem, forms }) =>
    stem.length >= minLength && forms.some((form) => field.includes(form)),
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
