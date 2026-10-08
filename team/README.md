# 역할 분담과 착수 순서

9/28 중간발표 범위(= "받는 쪽" 절반)를 4명이 나눠 맡습니다.
제품이 무엇이고 왜 이렇게 설계했는지는 루트의 [README.md](../README.md)를, 작업 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 먼저 읽어주세요.

## 담당

| 역할 | 담당 | 브리프 |
|---|---|---|
| **A** 프론트엔드 · 저장소 관리 | **정우성** | (이 문서 작성자) |
| **B** 백엔드 · DB · **발표** | **우희태** | [B-backend.md](B-backend.md) |
| **C** AI 파이프라인 | **김권섭** | [C-ai.md](C-ai.md) |
| **D** 데이터 조사 | **박용민** | [D-research.md](D-research.md) |

발표는 백엔드를 맡은 **우희태**가 합니다. 발표 준비 자료(5분 구성, 예상 반문, 데모 시나리오)는 [B-backend.md](B-backend.md) 끝에 있습니다.

## 9/28까지 만들 것

```
/setup       상황 입력 (구역·거주형태·계약형태·이사일·차·반려동물·학생)
/tasks       내 상황에 해당하는 할 일만 목록으로
/tasks/[id]  상세 — 안 하면 어떻게 되나 / 언제까지 / 어떻게 / 어디서 + 전화 걸기
/ask         질문하면 AI가 DB의 할 일만 근거로 답하고, 근거 신뢰도를 배지로 표시
```

**로그인은 만들지 않습니다.** 질문·답변·확인·승격은 본선(10/8~9) 범위입니다.

**중간발표에서 보여줄 장면은 하나입니다** — 계약형태를 전세 → 기숙사비로 바꿔 입력하면 **할 일 목록이 실제로 갈리는 것.** 전세면 확정일자가 뜨고 기숙사면 안 뜹니다.

## 의존 관계 — 여기가 막히면 전원이 멈춥니다

```
[A] lib/types.ts 확정  ──┬─→ [B] matching·dday·API
   (공용 계약)           ├─→ [C] grounding·gemini
                        └─→ [A] 화면 (목 API로 먼저)

[B] prisma/schema.prisma ──→ [B] 시딩 스크립트 ──→ [D] 시드 데이터 입력
```

**`lib/types.ts`는 A가 먼저 만듭니다.** 원래 계획은 B가 만드는 것이었지만, 화면과 목 API가 전부 이 타입 위에서 돌아가 A가 B를 기다리게 됩니다. 계약을 먼저 박아두고 B·C가 그 위에 구현합니다.

**이 파일들을 바꿀 때는 반드시 먼저 공유합니다.** 말 없이 바꾸면 세 명이 동시에 깨집니다.

- `prisma/schema.prisma` — 모델·필드·enum
- `lib/types.ts` — `Profile` · `TaskConditions` · `MatchedTask`
- `app/api/**` — 요청·응답 JSON 필드명

## 공용 타입 (A가 확정, 전원이 이걸 씁니다)

```ts
// lib/types.ts
export type HousingType = 'ONE_ROOM' | 'OFFICETEL' | 'DORM' | 'APARTMENT' | 'VILLA';
export type ContractType = 'MONTHLY' | 'JEONSE' | 'DORM_FEE' | 'OWNED';
export type TaskCategory = 'ADMIN' | 'WASTE' | 'HOUSING' | 'LIFE';
export type Confidence = 'GROUNDED' | 'PARTIAL' | 'UNKNOWN';

/** 사용자가 /setup에서 입력하는 상황. 상세 주소는 수집하지 않는다. */
export interface Profile {
  zone: string;
  housingType: HousingType;
  contractType: ContractType;
  moveInDate: string;   // 'YYYY-MM-DD'
  hasCar: boolean;
  hasPet: boolean;
  isStudent: boolean;
}

/** 할 일이 누구에게 보이는지. 빈 배열과 false는 "조건 없음"을 뜻한다. */
export interface TaskConditions {
  housingTypes: HousingType[];
  contractTypes: ContractType[];
  requiresCar: boolean;
  requiresPet: boolean;
  studentOnly: boolean;
}

/** API가 화면으로 내려보내는 할 일 한 건. */
export interface MatchedTask {
  id: string;
  title: string;
  why: string;
  howTo: string;
  category: TaskCategory;
  linkUrl: string | null;
  placeName: string | null;
  placeAddress: string | null;
  placePhone: string | null;
  daysLeft: number | null;
  overdue: boolean;
  stale: boolean;
  verifiedAt: string;   // ISO 8601
}
```

`lib/types.ts` 에는 위 타입 외에 **API 요청·응답 타입**도 함께 있습니다 — `MatchRequest` · `MatchResponse` · `TaskDetailResponse` · `AskRequest` · `AskResponse`. 라우트를 만들 때 반환 타입으로 쓰면 화면과 어긋나는 걸 컴파일 단계에서 잡습니다.

## 전원이 지키는 원칙 셋

**1. AI는 정보를 생성하지 않습니다.**
행정·생활 정보는 D가 조사해 넣은 시드 데이터와 주민이 확인한 답변만 씁니다. 전입신고 기한을 AI가 잘못 말하면 사용자가 **실제로 과태료를 냅니다.** AI는 이 데이터에서 질문에 맞는 카드를 골라 줄 뿐입니다(승격 초안 정리는 다음 단계). 문장은 쓰지 않습니다.

**2. 금액·기한·장소는 AI를 거치지 않습니다.**
AI는 문장을 쓰지 않고 카드만 고릅니다. 안내 문장은 서버 고정 문구이고, 구체적인 값은 DB 원문을 그대로 렌더한 카드로 붙입니다. 숫자가 AI를 통과하지 않으면 숫자는 틀리지 않습니다.

**3. 확인하지 못한 값은 넣지 않습니다.**
추정으로 채우지 않고 항목 전체를 비워둡니다. 모든 시드 항목은 `sourceNote`와 `verifiedAt`이 있어야 하고, 없으면 시딩이 실패합니다.

## 착수 순서

| 순서 | 누가 | 무엇을 | 끝나야 풀리는 것 |
|---|---|---|---|
| 0 | A | 스캐폴드 + `lib/types.ts` | 전원 |
| 0 | B | `prisma/schema.prisma` + 마이그레이션 | B의 API, D의 시드 입력 |
| 1 | D | **시드 데이터 조사** ← 최우선 | 데모의 내용물 전체 |
| 1 | B | `matching` · `dday` 순수 로직 + 테스트 | B의 match API |
| 1 | C | `grounding` · `search` 순수 로직 + 테스트 | C의 ask API |
| 2 | B | `/api/tasks/match` · `/api/tasks/[id]` | A의 화면이 목에서 진짜로 교체 |
| 2 | C | `lib/gemini.ts` + `/api/ask` | A의 `/ask` 화면 |
| 2 | A | `/setup` · `/tasks` · `/tasks/[id]` · `/ask` (목 API 기준) | |
| 3 | A | 목 → 실제 API 교체, 배포 | |
| 3 | B | 발표 자료 · 데모 시나리오 | |

## D의 조사가 최대 병목입니다

코드가 다 돌아가도 **보여줄 내용이 없으면 데모가 성립하지 않습니다.** 9/24 기준 확인된 시드는 3건(전입신고·확정일자·전월세신고)뿐이었습니다. 10/6 #22 로 쓰레기 배출 요일·종량제 봉투 판매처·주민센터 전화번호까지 17건이 확인돼 들어갔습니다.

조사가 늦어지면 **B·C도 하루 투입**합니다. A는 그동안 목 데이터로 화면을 계속 만들 수 있는 유일한 파트입니다.

## 테스트

**상태·판정이 걸린 순수 로직만** Vitest로 씁니다. UI와 라우트 배선은 `npm run dev` 후 브라우저 수동 확인입니다.

| 파일 | 담당 |
|---|---|
| `lib/matching.ts` | B |
| `lib/dday.ts` | B |
| `lib/grounding.ts` | C |
| `lib/search.ts` | C |

각 브리프에 통과해야 할 테스트 케이스가 그대로 적혀 있습니다. **테스트를 먼저 쓰고 실패를 확인한 뒤 구현하세요.**
