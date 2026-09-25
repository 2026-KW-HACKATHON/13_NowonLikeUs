# B — 백엔드 · DB · 발표 (우희태)

[team/README.md](README.md)의 공용 타입과 원칙을 먼저 읽어주세요. 이 문서는 그 위에서 B가 맡을 것만 다룹니다.

**맡는 것:** Prisma 스키마 인수, 순수 로직 2개(`matching`·`dday`)와 테스트, 시딩 스크립트, API 라우트 2개, **발표**
**안 맡는 것:** 화면(정우성), Gemini·근거 검증(김권섭), 시드 데이터 조사(박용민)

**발표를 맡으셨으니 이 문서 끝의 「발표 준비」를 먼저 읽어주세요.** 중간발표 채점 항목 중 발표가 10점이고, 나머지 90점도 발표자가 설명해야 합니다.

**커밋은 `<타입>: <제목>` 형식에 타입 대문자입니다** (`Feat` `Fix` `Test` `Chore` …). 작업 브랜치는 `dev`에서 따고 `dev`로 PR합니다. 자세한 건 [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## B-0. 스키마 인수 (가장 먼저)

`prisma/schema.prisma`와 첫 마이그레이션은 A가 프로젝트 뼈대를 세우면서 같이 만들어 뒀습니다. **B가 읽고 검토한 뒤 인수**해 주세요. 이후 스키마 변경은 전부 B가 주관합니다.

핵심 모델은 `Task`입니다.

```prisma
model Task {
  id            String       @id @default(cuid())
  title         String       // "전입신고 하기"
  why           String       // "기한을 넘기면 과태료, 보증금 보호를 못 받습니다"
  dueOffsetDays Int?         // 이사일 기준 며칠. null이면 기한 없음
  howTo         String
  linkUrl       String?
  placeName     String?      // "월계1동 주민센터"
  placeAddress  String?
  placePhone    String?      // 전화 걸기 버튼에 쓰인다
  category      TaskCategory // ADMIN | WASTE | HOUSING | LIFE

  // 노출 조건 — 빈 배열/false는 "조건 없음"
  housingTypes  HousingType[]
  contractTypes ContractType[]
  requiresCar   Boolean @default(false)
  requiresPet   Boolean @default(false)
  studentOnly   Boolean @default(false)

  source                 TaskSource @default(SEED)  // SEED | PROMOTED
  promotedFromQuestionId String?
  sourceNote             String     // 필수 — 출처와 확인 경로
  verifiedAt             DateTime   // 필수 — 확인 날짜
  isPublished            Boolean    @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

알아두실 설계 판단 세 가지:

- **노출 조건을 별도 테이블로 빼지 않고 `Task`에 직접 달았습니다.** 조건이 단순하고 개수가 적어 별도 테이블은 과설계입니다. 조합이 복잡해지면 그때 분리합니다.
- **`sourceNote`를 필수(`String`)로 뒀습니다.** "정보의 출처는 항상 사람"이라는 원칙을 DB 레벨에서 강제합니다.
- **`Question.askerId`는 nullable입니다.** 9/28엔 로그인이 없어 작성자를 특정할 수 없습니다. 본선에서 로그인을 붙이면 채워집니다. `User`·`Answer`·`Confirmation` 모델도 이미 있지만 **이번 범위에서는 쓰지 않습니다** — 마이그레이션을 두 번 돌려 A·C를 두 번 멈추게 하지 않으려고 미리 만들어 둔 것입니다.

---

## B-1. `lib/matching.ts` — 프로필 → 할 일 필터

**파일:** `lib/matching.ts`, `tests/matching.test.ts`

**이 함수가 9/28 시연의 핵심입니다.** 전세로 입력하면 확정일자가 뜨고 기숙사면 안 뜨는 것이 여기서 갈립니다.

**내보낼 것**

```ts
matchesProfile(conditions: TaskConditions, profile: Profile): boolean
filterByProfile<T extends TaskConditions>(items: T[], profile: Profile): T[]
```

**규칙**

- 배열 조건이 **비어 있으면 전원 해당**. 값이 있으면 프로필이 그 안에 있어야 한다
- `requiresCar` · `requiresPet` · `studentOnly`가 `true`면 프로필의 해당 불리언도 `true`여야 한다
- **조건이 하나라도 어긋나면 `false`**

**먼저 쓸 테스트 — 이게 스펙입니다.** 구현 전에 작성하고 실패를 확인하세요.

```ts
import { describe, it, expect } from 'vitest';
import { matchesProfile, filterByProfile } from '@/lib/matching';
import type { Profile, TaskConditions, ContractType } from '@/lib/types';

const jeonseOneRoom: Profile = {
  zone: 'A', housingType: 'ONE_ROOM', contractType: 'JEONSE',
  moveInDate: '2026-03-02', hasCar: false, hasPet: false, isStudent: true,
};

const noConditions: TaskConditions = {
  housingTypes: [], contractTypes: [],
  requiresCar: false, requiresPet: false, studentOnly: false,
};

describe('matchesProfile', () => {
  it('조건이 전부 비어 있으면 누구에게나 해당한다', () => {
    expect(matchesProfile(noConditions, jeonseOneRoom)).toBe(true);
  });
  it('거주형태가 목록에 있으면 해당한다', () => {
    expect(matchesProfile({ ...noConditions, housingTypes: ['ONE_ROOM', 'VILLA'] }, jeonseOneRoom)).toBe(true);
  });
  it('거주형태가 목록에 없으면 해당하지 않는다', () => {
    expect(matchesProfile({ ...noConditions, housingTypes: ['APARTMENT'] }, jeonseOneRoom)).toBe(false);
  });
  it('계약형태가 목록에 없으면 해당하지 않는다', () => {
    expect(matchesProfile({ ...noConditions, contractTypes: ['DORM_FEE'] }, jeonseOneRoom)).toBe(false);
  });
  it('차량이 필요한 항목은 차량 없는 사람에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, requiresCar: true }, jeonseOneRoom)).toBe(false);
    expect(matchesProfile({ ...noConditions, requiresCar: true }, { ...jeonseOneRoom, hasCar: true })).toBe(true);
  });
  it('반려동물이 필요한 항목은 반려동물 없는 사람에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, requiresPet: true }, jeonseOneRoom)).toBe(false);
  });
  it('학생 전용 항목은 비학생에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, studentOnly: true }, { ...jeonseOneRoom, isStudent: false })).toBe(false);
  });
  it('조건 중 하나만 어긋나도 해당하지 않는다', () => {
    expect(matchesProfile({ ...noConditions, housingTypes: ['ONE_ROOM'], requiresCar: true }, jeonseOneRoom)).toBe(false);
  });
});

describe('filterByProfile', () => {
  it('해당하는 항목만 남긴다', () => {
    const items = [
      { id: 'a', ...noConditions },
      { id: 'b', ...noConditions, contractTypes: ['DORM_FEE'] as ContractType[] },
      { id: 'c', ...noConditions, contractTypes: ['JEONSE'] as ContractType[] },
    ];
    expect(filterByProfile(items, jeonseOneRoom).map((i) => i.id)).toEqual(['a', 'c']);
  });
});
```

---

## B-2. `lib/dday.ts` — 기한과 신선도

**파일:** `lib/dday.ts`, `tests/dday.test.ts`

**내보낼 것**

```ts
STALE_AFTER_DAYS: number                  // 183 (약 6개월)
daysUntilDue(moveInDate: string, dueOffsetDays: number | null, today: Date): number | null
isOverdue(daysLeft: number | null): boolean
isStale(verifiedAt: Date, today: Date): boolean
```

**주의:** `today`를 인자로 받습니다. 내부에서 `new Date()`를 부르면 테스트가 불가능해집니다.
**날짜만 비교합니다.** 같은 날 안에서 시각이 달라도 결과가 같아야 하므로 UTC 자정으로 잘라서 계산하세요.

**먼저 쓸 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { daysUntilDue, isOverdue, isStale, STALE_AFTER_DAYS } from '@/lib/dday';

describe('daysUntilDue', () => {
  it('이사일 당일이면 오프셋 그대로 남는다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-02T09:00:00Z'))).toBe(14);
  });
  it('기한 당일이면 0이다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-16T23:00:00Z'))).toBe(0);
  });
  it('기한이 지나면 음수다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-17T00:00:00Z'))).toBe(-1);
  });
  it('오프셋이 null이면 기한이 없으므로 null이다', () => {
    expect(daysUntilDue('2026-03-02', null, new Date('2026-03-02T00:00:00Z'))).toBeNull();
  });
  it('같은 날 안에서는 시각이 달라도 결과가 같다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-10T00:00:00Z')))
      .toBe(daysUntilDue('2026-03-02', 14, new Date('2026-03-10T23:59:00Z')));
  });
});

describe('isOverdue', () => {
  it('남은 날이 음수면 지난 것이다', () => { expect(isOverdue(-1)).toBe(true); });
  it('당일과 미래는 지나지 않았다', () => {
    expect(isOverdue(0)).toBe(false);
    expect(isOverdue(3)).toBe(false);
  });
  it('기한이 없으면 지날 수 없다', () => { expect(isOverdue(null)).toBe(false); });
});

describe('isStale', () => {
  it('기준일수를 넘기면 오래된 정보다', () => {
    const today = new Date('2026-09-24T00:00:00Z');
    expect(isStale(new Date(today.getTime() - (STALE_AFTER_DAYS + 1) * 86400000), today)).toBe(true);
  });
  it('기준일수 이내면 오래되지 않았다', () => {
    const today = new Date('2026-09-24T00:00:00Z');
    expect(isStale(new Date(today.getTime() - 10 * 86400000), today)).toBe(false);
  });
});
```

---

## B-3. 시딩 스크립트

**파일:** `prisma/seed-data.ts`, `prisma/seed.ts`, `package.json`(스크립트 추가)

**D가 조사 결과를 넣을 그릇을 B가 만듭니다.** 양식이 없으면 D가 조사해와도 넣을 데가 없습니다.

`prisma/seed-data.ts`는 `seedTasks: SeedTask[]` 배열 하나를 내보냅니다.

```ts
import type { Prisma } from '@prisma/client';
export type SeedTask = Omit<Prisma.TaskCreateInput, 'id' | 'createdAt' | 'updatedAt'>;
export const seedTasks: SeedTask[] = [ /* ... */ ];
```

`prisma/seed.ts`는 **삽입 전에 검증**합니다. 이게 원칙을 코드로 강제하는 자리입니다.

```ts
function assertSourced(): void {
  const bad = seedTasks.filter((t) => !t.sourceNote || t.sourceNote.trim() === '' || !t.verifiedAt);
  if (bad.length > 0) {
    throw new Error(`sourceNote 또는 verifiedAt이 비어 있는 항목이 있습니다: ${bad.map((t) => t.title).join(', ')}`);
  }
}
```

그다음 `source: 'SEED'`인 기존 행만 지우고(승격된 행은 건드리지 않습니다) 새로 넣습니다. `package.json`에 `"seed": "tsx prisma/seed.ts"`를 추가하세요.

**검증 단계를 꼭 확인하세요.** 일부러 `sourceNote`를 비우고 `npm run seed`가 **실패하는지** 본 뒤 되돌리세요. 실패하지 않으면 이 장치는 없는 것과 같습니다.

### 확인된 시드 3건 (지금 넣을 수 있는 전부)

나머지는 D가 조사해서 채웁니다. **확인 안 된 항목은 만들지 마세요.**

| 제목 | 기한 | 조건 | 출처 |
|---|---|---|---|
| 전입신고 하기 | 이사일 +14일 | 전원 | 찾기쉬운 생활법령정보 / 정부24 원스톱 |
| 확정일자 받기 | 이사일 +14일 | `contractTypes: ['MONTHLY','JEONSE']` | 찾기쉬운 생활법령정보 |
| 전월세 신고하기 | **`null`** | `contractTypes: ['MONTHLY','JEONSE']` | 임대차 신고 기준 |

**전월세신고의 `dueOffsetDays`가 `null`인 이유:** 이 신고의 기한은 **계약일**로부터 30일인데 `dueOffsetDays`는 **이사일** 기준입니다. 환산하면 틀린 날짜가 나옵니다. 기한 계산을 비우고 `howTo`에 "보증금 6천만 원 초과 또는 월세 30만 원 초과 계약은 계약일로부터 30일 이내"라고 원문을 적으세요. **이런 경우가 또 나오면 같은 방식으로 처리합니다.**

---

## B-4. `POST /api/tasks/match`

**파일:** `app/api/tasks/match/route.ts`

**요청** `{ profile: Profile }` — 프로필은 브라우저 localStorage에 있어서 클라이언트가 실어 보냅니다 (로그인이 없습니다)
**응답** `{ tasks: MatchedTask[] }`

하는 일:

1. `prisma.task.findMany({ where: { isPublished: true } })`
2. `filterByProfile(rows, profile)`
3. 각 행을 `MatchedTask`로 변환 — `daysLeft`는 `daysUntilDue(profile.moveInDate, t.dueOffsetDays, today)`, `overdue`는 `isOverdue(daysLeft)`, `stale`은 `isStale(t.verifiedAt, today)`, `verifiedAt`은 ISO 문자열로
4. **기한이 임박한 순으로 정렬하되 `daysLeft === null`은 뒤로** 보냅니다
5. `profile`이나 `profile.moveInDate`가 없으면 `400`

## B-5. `GET /api/tasks/[id]`

**파일:** `app/api/tasks/[id]/route.ts`

**쿼리** `?moveInDate=YYYY-MM-DD` (선택) — 없으면 `daysLeft: null`
**응답** `{ task: MatchedTask }`, 없거나 `isPublished`가 false면 `404`

Next.js 15에서 `params`는 Promise입니다.

```ts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

`MatchedTask` 변환 로직이 B-4와 같으니 **한 군데로 뽑아 쓰세요.** 두 라우트가 다른 모양을 내려보내면 화면이 깨집니다.

---

---

## 발표 준비

### 5분 구성 제안

| 순서 | 내용 | 분량 |
|---|---|---|
| 1 | **문제** — 월계1동은 캠퍼스 때문에 코호트가 매년 교체되고, 그때마다 생활 지식이 0에서 다시 시작된다. 진짜 문제는 "모른다는 걸 모르는 것" | 1분 |
| 2 | **근거** — 국민권익위가 **2026-09-16** 「전입자 생활정보 사전안내 강화 방안」을 행안부·기초지방정부에 권고. 생활폐기물 배출 정보 포함. **노원구도 이행 대상** | 30초 |
| 3 | **데모** — 상황을 바꿔 입력하면 할 일이 갈린다 | 2분 |
| 4 | **차별점** — 이사노트·정부24·에브리타임과의 자리 차이 | 1분 |
| 5 | **지속성** — 무료 티어로 운영 가능, 다른 대학가로 복제 가능 | 30초 |

### 반드시 준비해야 할 반문 세 개

**"이거 이사노트 아닌가요?"**
[isanote.kr](https://isanote.kr/)은 이사일과 유형만 넣으면 전입신고·확정일자·전월세신고를 D-30~D+3으로 배치해 줍니다. **타임라인 구조는 같습니다.** 갈리는 건 셋입니다 — ① 동네마다 다른 생활 정보를 다룬다 ② 개인화 축이 *시점*이 아니라 *상황*이다 ③ 질문이 승격돼 목록이 자란다. **타임라인 자체를 차별점으로 내세우면 그 자리에서 무너집니다.**

**"곧 정부가 하지 않나요?"**
권익위 권고 내용은 **"누리집·전자책 등으로 종합 안내"**, 즉 **정적 안내물**입니다. 상황별 분기도, 질문-답변도, 갱신 구조도 없습니다. 강제도 아니어서 지자체가 각자 이행합니다. **노원구가 이행하려면 도구가 필요하고, 그게 이겁니다.**

**"오래 산 주민이 참여하겠어요?"**
강화군이 전입자와 주민을 1:1로 연결하는 **'동네안내자'** 를 운영 중입니다. 12개 읍·면 + 분야별 안내자 50여 명, 11월까지 200회 목표. 주민 워크숍으로 쓰레기 배출법·마을 규약을 담은 '슬기로운 동네생활 가이드'를 직접 만들었습니다. **지자체가 실제로 주민을 동원해 하고 있습니다.** 다만 1:1 오프라인은 확장되지 않고 안내자가 그만두면 지식도 사라집니다. 우리는 같은 일을 **웹에서, 쌓이는 구조로** 합니다.

### 데모 시나리오

1. `/setup`에서 **전세**로 입력 → 할 일 3건 (전입신고·확정일자·전월세신고)
2. `/setup`으로 돌아가 **기숙사비**로 변경 → **1건으로 줄어듦**
3. 이사일을 30일 전으로 → **"기한 16일 지남"** 표시
4. 상세 진입 → 안 하면 어떻게 되나 / 언제까지 / 어디서 + **전화 걸기**
5. `/ask`에서 아는 걸 질문 → **초록 배지** + 원문 카드
6. `/ask`에서 모르는 걸 질문 → **회색 배지** + "다음 사람에게 보이게 됩니다"

**6번이 이 앱의 논지입니다.** AI가 모른다고 답하는 것이 실패가 아니라, 거기서 지식이 자라기 시작한다는 것.

### 시연 전 체크

- **발표 5~10분 전에 앱에 한 번 접속해 DB를 깨워두세요.** Neon 무료 티어는 5분간 요청이 없으면 컴퓨트를 정지시켜 첫 조회가 1~3초 걸립니다
- Gemini 쿼터 잔량 확인
- 위 6단계를 한 번 리허설

---

---

## 완료 기준

- [ ] `npm test`에서 `matching` 9건 · `dday` 10건 통과
- [ ] `npm run seed`가 3건을 넣고, `sourceNote`를 비우면 **실패**한다
- [ ] `/api/tasks/match`에 전세 프로필을 보내면 3건, 기숙사비 프로필을 보내면 1건이 온다
- [ ] 이사일을 30일 전으로 보내면 전입신고의 `overdue`가 `true`, `daysLeft`가 `-16`이다
- [ ] `/api/tasks/[id]`가 없는 id에 404를 낸다

**세 번째 항목이 9/28 시연 그 자체입니다.** 이게 되면 발표에서 보여줄 장면이 완성됩니다.

발표 쪽 완료 기준은 따로입니다.

- [ ] 5분 발표 자료
- [ ] 반문 세 개에 대한 답 숙지
- [ ] 데모 시나리오 리허설 1회
