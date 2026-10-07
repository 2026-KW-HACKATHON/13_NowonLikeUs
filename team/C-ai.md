# C — AI 파이프라인 (김권섭)

[team/README.md](README.md)의 공용 타입과 원칙을 먼저 읽어주세요. 이 문서는 그 위에서 C가 맡을 것만 다룹니다.

**맡는 것:** 근거 검증(`grounding`)과 폴백 검색(`search`) 순수 로직 + 테스트, Gemini 호출, `/api/ask`
**안 맡는 것:** 화면(정우성), 스키마·`matching`·`dday`·다른 API(우희태), 시드 조사(박용민)

---

## 이 역할의 핵심 문장

**AI는 정보를 생성하지 않고, 보여줄 원문 카드만 고릅니다.**

전입신고 기한을 AI가 잘못 말하면 사용자가 **실제로 과태료를 냅니다.** 그래서 이 파이프라인은 "똑똑하게 답하기"가 아니라 **"틀린 말을 못 하게 막기"** 가 목표입니다. AI가 할 일은 DB에 있는 원문 카드의 ID를 고르고 근거 신뢰도를 제안하는 것뿐입니다. AI가 만든 안내 문장은 사용자에게 보내거나 DB에 저장하지 않습니다.

C가 만드는 것 중 **가장 중요한 건 `lib/grounding.ts`** 입니다. 이게 오정보 방어의 2층이고, 없으면 나머지가 다 의미 없습니다.

---

## C-1. `lib/grounding.ts` — AI가 지어낸 근거 걸러내기

**파일:** `lib/grounding.ts`, `tests/grounding.test.ts`

**AI는 존재하지 않는 id를 지어냅니다.** `task:99` 같은 걸 근거랍시고 붙입니다. 서버가 실제 id 집합과 대조하지 않으면 답변을 신뢰할 근거가 사라집니다.

**내보낼 것**

```ts
export interface GroundingResult {
  confidence: Confidence;        // 'GROUNDED' | 'PARTIAL' | 'UNKNOWN'
  validSourceIds: string[];
  droppedSourceIds: string[];
}

verifyGrounding(claimed: string[], known: Set<string>, aiConfidence: Confidence): GroundingResult
```

**규칙**

| 상황 | 결과 |
|---|---|
| 근거가 전부 실재 + AI가 `GROUNDED` | `GROUNDED` |
| 허구 id가 섞임 | **`PARTIAL`로 강등** |
| 근거가 전부 허구 | **`UNKNOWN`으로 강등** |
| 근거를 아예 안 달았음 | `UNKNOWN` |
| AI가 스스로 `UNKNOWN`이라 함 | **`UNKNOWN` (올려주지 않음)** |
| 중복된 id | 한 번만 센다 |

**먼저 쓸 테스트 — 이게 스펙입니다.**

```ts
import { describe, it, expect } from 'vitest';
import { verifyGrounding } from '@/lib/grounding';

const known = new Set(['task:a', 'task:b']);

describe('verifyGrounding', () => {
  it('근거가 전부 실재하면 AI 신뢰도를 그대로 쓴다', () => {
    const r = verifyGrounding(['task:a'], known, 'GROUNDED');
    expect(r.confidence).toBe('GROUNDED');
    expect(r.validSourceIds).toEqual(['task:a']);
    expect(r.droppedSourceIds).toEqual([]);
  });
  it('허구 id가 섞이면 PARTIAL로 강등한다', () => {
    const r = verifyGrounding(['task:a', 'task:zzz'], known, 'GROUNDED');
    expect(r.confidence).toBe('PARTIAL');
    expect(r.validSourceIds).toEqual(['task:a']);
    expect(r.droppedSourceIds).toEqual(['task:zzz']);
  });
  it('근거가 전부 허구면 UNKNOWN으로 강등한다', () => {
    const r = verifyGrounding(['task:zzz'], known, 'GROUNDED');
    expect(r.confidence).toBe('UNKNOWN');
    expect(r.validSourceIds).toEqual([]);
  });
  it('근거를 아예 안 달았으면 UNKNOWN이다', () => {
    expect(verifyGrounding([], known, 'GROUNDED').confidence).toBe('UNKNOWN');
  });
  it('AI가 UNKNOWN이라 했으면 근거가 실재해도 UNKNOWN이다', () => {
    const r = verifyGrounding(['task:a'], known, 'UNKNOWN');
    expect(r.confidence).toBe('UNKNOWN');
    expect(r.validSourceIds).toEqual([]);
  });
  it('AI가 PARTIAL이라 했으면 근거가 실재해도 PARTIAL을 유지한다', () => {
    expect(verifyGrounding(['task:a'], known, 'PARTIAL').confidence).toBe('PARTIAL');
  });
  it('중복된 근거 id는 한 번만 센다', () => {
    expect(verifyGrounding(['task:a', 'task:a'], known, 'GROUNDED').validSourceIds).toEqual(['task:a']);
  });
});
```

---

## C-2. `lib/search.ts` — AI가 죽었을 때의 폴백

**파일:** `lib/search.ts`, `tests/search.test.ts`

Gemini 호출이 실패하거나 쿼터가 끊기면, 프로필에 맞게 거른 할 일 안에서 관련 항목을
최대 3개 찾아 반환합니다. **본선 시연 중에 일어날 수 있는 일입니다.**

```ts
keywordSearch<T extends { title: string; why: string; howTo: string }>(
  items: T[], query: string, limit = 3
): T[]
```

질문을 공백으로 쪼개 낱말이 몇 개 걸리는지로 점수를 매기고 높은 순으로 돌려줍니다. **임베딩이나 벡터 DB를 쓰지 않는 것은 의도된 설계입니다** — 항목이 100건 내외라 이걸로 충분하고, 해커톤 기간에 디버깅할 데를 하나 늘릴 이유가 없습니다.

**먼저 쓸 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { keywordSearch } from '@/lib/search';

const items = [
  { id: '1', title: '전입신고 하기', why: '과태료가 부과됩니다', howTo: '주민센터 방문' },
  { id: '2', title: '확정일자 받기', why: '보증금 보호', howTo: '임대차계약서 지참' },
  { id: '3', title: '음식물 쓰레기 버리기', why: '과태료', howTo: '전용 봉투 사용' },
];

describe('keywordSearch', () => {
  it('제목에 포함된 말로 찾는다', () => {
    expect(keywordSearch(items, '전입신고').map((i) => i.id)).toEqual(['1']);
  });
  it('절차 설명에 포함된 말로도 찾는다', () => {
    expect(keywordSearch(items, '임대차계약서').map((i) => i.id)).toEqual(['2']);
  });
  it('여러 낱말 중 하나라도 걸리면 찾는다', () => {
    expect(keywordSearch(items, '쓰레기 봉투').map((i) => i.id)).toContain('3');
  });
  it('많이 걸린 항목이 먼저 온다', () => {
    expect(keywordSearch(items, '과태료 전입신고').map((i) => i.id)[0]).toBe('1');
  });
  it('걸리는 게 없으면 빈 배열이다', () => {
    expect(keywordSearch(items, '주차장')).toEqual([]);
  });
  it('limit만큼만 돌려준다', () => {
    expect(keywordSearch(items, '과태료', 1)).toHaveLength(1);
  });
  it('빈 질문에는 빈 배열을 돌려준다', () => {
    expect(keywordSearch(items, '   ')).toEqual([]);
  });
});
```

---

## C-3. `lib/gemini.ts` — 호출 래퍼

**파일:** `lib/gemini.ts`

SDK 없이 **REST로 직접 호출**합니다. 환경 변수는 `GEMINI_API_KEY`, `GEMINI_MODEL`(기본 `gemini-3.1-flash-lite`)입니다.

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
헤더: x-goog-api-key: {키}
```

```ts
export interface GeminiAnswer {
  sourceIds: string[];
  confidence: Confidence;
}

askGemini(question: string, knowledge: string, profileLine: string): Promise<GeminiAnswer | null>
```

**실패하면 반드시 `null`을 돌려주세요.** 던지지 마세요. 호출자가 폴백을 타야 합니다. 키가 없을 때, HTTP 에러일 때, JSON 파싱이 깨질 때, 타임아웃(15초)일 때 전부 `null`입니다.

**구조화 출력을 씁니다.** `generationConfig`에 `responseMimeType: 'application/json'`과 `responseSchema`(`sourceIds` string[] / `confidence` enum)를 넣고 `temperature: 0`으로 두세요.

### 프롬프트 규칙 — 여기가 1층·3층 방어입니다

```
너는 월계1동 생활 안내 도우미다.

규칙:
1. 아래 <지식>에서 질문에 답하는 데 필요한 항목만 고른다.
2. <지식>에 없으면 confidence를 UNKNOWN으로 하고 sourceIds는 빈 배열로 둔다. 추측하지 않는다.
3. 근거로 쓴 항목의 id를 sourceIds에 그대로 넣는다. 지식에 없는 id를 만들지 않는다.
```

Gemini는 안내 문장을 만들지 않고 근거 카드만 고릅니다. 화면과 저장소의 안내 문장은
서버가 소유한 고정 문구만 사용하고, 숫자와 상세 설명은 검증된 DB 원문 카드가 담당합니다.

지식 블록은 한 줄에 한 항목입니다.

```
task:{id} | {title} | {why} | {howTo}
```

---

## C-4. `POST /api/ask`

**파일:** `app/api/ask/route.ts`

**요청** `{ text: string; profile?: Profile }`
**응답** `{ mode: 'AI' | 'FALLBACK'; answer: string | null; confidence: Confidence; tasks: MatchedTask[]; questionId: string }`

흐름:

1. `text`가 비면 `400`
2. `prisma.task.findMany({ where: { isPublished: true } })`로 공개 지식 준비
3. 프로필이 있으면 `{ ...profile, zone: '' }`을 만들어 `matchesProfile`로 먼저 거릅니다. 차량·반려동물·학생 여부가 없으면 `false`로 봅니다
4. 프로필에 맞는 전체 후보를 지식으로 구성해 `askGemini(...)` 호출. 후보가 없으면 외부 호출 없이 폴백
5. **`null`이거나 6번 검증 결과가 `UNKNOWN`이면 폴백** — 프로필에 맞는 후보 안에서 `keywordSearch`를 실행하고 `mode: 'FALLBACK'`, `answer: null`, `confidence: 'UNKNOWN'`으로 응답. **절대 500을 내지 마세요.**
6. 응답이 있으면 프로필에 맞는 후보 ID 집합을 `knownIds`로 사용해 `verifyGrounding(ai.sourceIds, knownIds, ai.confidence)`
7. `validSourceIds`의 순서(AI가 고른 순서)대로 최대 3개만 `tasks`에 담습니다 — 화면이 이걸 원문 카드로 렌더합니다
8. **`confidence`가 `UNKNOWN`이면 `answer`를 `null`로 보내고, 그 외에는 서버 고정 안내를 보냅니다.** 안내 문장은 서버에서만 생성합니다
9. `Question`을 저장합니다 — `text`, `aiAnswer`, `sourceIds`(검증을 통과하고 화면에 보여준 것만), `confidence`, `ctxHousingType`, `ctxContractType`

**구현 시 연결 규칙:** 6~8번은 `lib/grounding.ts`의 `groundAnswer(ai, knownIds)`로 함께 처리합니다.
반환된 서버 고정 `answer`와 `confidence`를 API 응답 및 `Question.aiAnswer` 저장에 사용하고,
카드와 저장할 근거는 `validSourceIds`에서 선택합니다. Gemini에는 안내 문장을 요구하지 않습니다.
AI가 `GROUNDED`라고 했어도 서버 검증 후 `UNKNOWN`이면 `answer`는 반드시 `null`입니다.
차량·반려동물·학생 여부는 필터에만 쓰고 DB 저장이나 Gemini 전송에는 포함하지 않습니다.

**`askerId`는 채우지 마세요.** 9/28엔 로그인이 없어 nullable입니다.

**상황 스냅샷(`ctx*`)을 남기는 이유:** 본선에서 이 질문이 할 일로 승격될 때 "이 답이 누구에게 해당하는지" 추론하는 근거가 됩니다. 전세 세입자가 물어서 나온 답이 기숙사생에게 뜨면 안 됩니다.

### `UNKNOWN`이 실패가 아닙니다

`UNKNOWN`은 **이 앱이 자라는 지점**입니다. 화면은 "아직 아무도 확인하지 않았습니다"를 띄우고 다음 사람에게 보이게 된다고 안내합니다. 본선에서 여기에 주민 답변과 승격이 붙습니다. **모른다고 정확히 말하는 것이 이 파이프라인의 성공입니다.**

---

## 완료 기준

- [ ] `npm test`에서 `grounding` 7건 · `search` 7건 통과
- [ ] `curl -X POST /api/ask -d '{"text":"전입신고 언제까지 해야 해요?"}'` → `mode: "AI"`, `confidence: "GROUNDED"`, `tasks`에 전입신고
- [ ] 원룸 프로필에는 기숙사 전용 카드가 나오지 않는다
- [ ] Gemini에는 프로필에 맞는 전체 후보가 전달되고 프로필 밖 ID는 근거에서 제외된다
- [ ] Gemini 실패 시에는 프로필에 맞는 할 일 안에서만 키워드 검색한다
- [ ] Gemini 응답 스키마에는 `answer`가 없고 API의 `answer`는 서버 고정 안내다
- [ ] 지식에 없는 걸 물으면 `confidence: "UNKNOWN"`, `answer: null`
- [ ] **`GEMINI_API_KEY`를 빈 문자열로 두고 같은 요청을 보내면 `mode: "FALLBACK"`이 오고 500이 나지 않는다**

세 번째와 다섯 번째가 이 역할의 진짜 산출물입니다. 답이 그럴듯한 것보다 **틀린 말을 안 하는 것**이 중요합니다.
