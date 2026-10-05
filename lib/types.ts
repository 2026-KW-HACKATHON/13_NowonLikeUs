/**
 * 화면 · API · AI 가 공유하는 타입 계약.
 *
 * 이 파일을 바꾸면 세 담당자가 동시에 영향을 받는다.
 * 필드 추가 · 삭제 · `| null` 변경은 병합 전에 팀에 공유할 것 (CONTRIBUTING.md).
 *
 * Prisma 가 생성하는 타입을 쓰지 않고 따로 두는 이유:
 * 클라이언트 컴포넌트가 `@prisma/client` 를 import 하면 서버 코드가 번들에 딸려 들어간다.
 */

export type HousingType = 'ONE_ROOM' | 'OFFICETEL' | 'DORM' | 'APARTMENT' | 'VILLA';
export type ContractType = 'MONTHLY' | 'JEONSE' | 'DORM_FEE' | 'OWNED';
export type TaskCategory = 'ADMIN' | 'WASTE' | 'HOUSING' | 'LIFE';

/** AI 답변의 근거 신뢰도. 서버가 근거 id 를 실제 id 와 대조해 강등한 뒤의 값. */
export type Confidence = 'GROUNDED' | 'PARTIAL' | 'UNKNOWN';

/**
 * 사용자가 /setup 에서 입력하는 상황.
 *
 * 상세 주소(번지 · 건물명 · 호수)는 수집하지 않는다. 필드 자체를 두지 않아
 * 실수로 들어갈 수 없게 한다. 쓰레기 배출 요일이 갈리는 구역 단위면 충분하다.
 *
 * 로그인이 없으므로 이 값은 브라우저 localStorage 에만 저장되고,
 * 할 일을 조회할 때 API 로 실어 보낸다.
 */
export interface Profile {
  /** 월계1동 내 구역. 조사 결과 구역별로 갈리지 않으면 선택 자체를 없앤다. */
  zone: string;
  housingType: HousingType;
  contractType: ContractType;
  /** 'YYYY-MM-DD' */
  moveInDate: string;
  hasCar: boolean;
  hasPet: boolean;
  isStudent: boolean;
}

/**
 * 할 일이 누구에게 보이는지.
 *
 * 빈 배열과 false 는 "조건 없음" — 전원에게 해당한다.
 * 조건이 하나라도 어긋나면 그 할 일은 목록에 나오지 않는다.
 */
export interface TaskConditions {
  housingTypes: HousingType[];
  contractTypes: ContractType[];
  requiresCar: boolean;
  requiresPet: boolean;
  studentOnly: boolean;
}

/**
 * API 가 화면으로 내려보내는 할 일 한 건.
 *
 * 금액 · 기한 · 장소는 DB 원문 그대로다. AI 가 이 값들을 다시 쓰지 않는다.
 * `| null` 이 붙은 필드는 화면에서 분기가 필요하다는 뜻이다.
 */
export interface MatchedTask {
  id: string;
  /** 뭘 해야 하나 */
  title: string;
  /** 안 하면 어떻게 되나 — 이게 없으면 사람은 안 한다 */
  why: string;
  /** 어떻게 하나 */
  howTo: string;
  category: TaskCategory;

  /** 온라인 신청 링크. 없으면 버튼을 숨긴다. */
  linkUrl: string | null;
  placeName: string | null;
  placeAddress: string | null;
  /** 있으면 `tel:` 링크로 바로 전화 걸기. 없으면 "어디서" 구획을 숨긴다. */
  placePhone: string | null;

  /** 기한까지 남은 날. null 이면 기한이 없는 할 일이다. */
  daysLeft: number | null;
  /** daysLeft 가 음수일 때 true */
  overdue: boolean;
  /** 마지막 확인일로부터 6개월이 지났으면 true — "오래된 정보" 배지 */
  stale: boolean;
  /** ISO 8601. 화면에는 "○년 ○월 기준"으로 표시한다. */
  verifiedAt: string;
}

/** POST /api/tasks/match 요청 */
export interface MatchRequest {
  profile: Profile;
}

/** POST /api/tasks/match 응답 — 기한이 임박한 순, 기한 없는 항목은 뒤로 */
export interface MatchResponse {
  tasks: MatchedTask[];
}

/** GET /api/tasks/[id] 응답 */
export interface TaskDetailResponse {
  task: MatchedTask;
}

/**
 * 질문과 함께 보내는 상황 정보.
 *
 * 서버는 주거형태 · 계약형태를 질문 상황으로 저장하고, 이사일은 카드 기한 계산에만 쓴다.
 * 나머지 프로필 필드(구역 · 차량 · 반려동물 · 학생 여부)는 쓰지 않으므로 보내지 않는다.
 */
export type AskProfile = Pick<Profile, 'housingType' | 'contractType' | 'moveInDate'>;

/** POST /api/ask 요청 */
export interface AskRequest {
  text: string;
  profile?: AskProfile;
}

/**
 * POST /api/ask 응답.
 *
 * `mode` 가 'FALLBACK' 이면 Gemini 호출이 실패해 키워드 검색으로 답한 것이다.
 * 이때 `answer` 는 null 이고 `tasks` 에 관련 항목만 담긴다. 앱은 멈추지 않는다.
 *
 * `confidence` 가 'UNKNOWN' 이면 `answer` 는 null 이다.
 * 근거 없는 문장을 화면에 띄우지 않는다.
 */
export interface AskResponse {
  mode: 'AI' | 'FALLBACK';
  answer: string | null;
  confidence: Confidence;
  tasks: MatchedTask[];
  questionId: string;
}
