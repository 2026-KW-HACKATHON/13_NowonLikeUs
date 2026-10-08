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
 * 전체 프로필은 브라우저 localStorage 에 저장되고 할 일을 조회할 때 API 로 보낸다.
 * 질문 제출 시에는 주거형태·계약형태만 질문과 함께 DB에 저장한다.
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
 * 서버는 이 값으로 할 일을 내 상황에 맞는 것만 거른 뒤 찾는다 (`lib/matching.ts` 와 같은 규칙).
 * 화면이 받는 카드에는 노출 조건이 없어서, 거르는 일은 서버만 할 수 있다.
 *
 * - 주거형태 · 계약형태: 거르기 + 질문 상황으로 DB 저장 + AI 에 한 줄로 전달
 * - 차량 · 반려동물 · 학생 여부: 거르기에만 쓴다. 저장하지 않고 외부로 보내지 않는다
 * - 이사일: 카드의 남은 날짜 계산에만 쓴다. 저장하지 않고 외부로 보내지 않는다
 *
 * 구역은 보내지 않는다. 월계1동 안에서 구역별로 갈리는 할 일이 없다.
 */
export type AskProfile = Pick<
  Profile,
  'housingType' | 'contractType' | 'moveInDate' | 'hasCar' | 'hasPet' | 'isStudent'
>;

/** POST /api/ask 요청 */
export interface AskRequest {
  text: string;
  profile?: AskProfile;
}

/**
 * POST /api/ask 응답.
 *
 * `mode` 가 'FALLBACK' 이면 외부 전송 비활성화, 호출 실패, 또는 AI 근거 검증 결과가
 * UNKNOWN 이어서 키워드 검색을 사용한 것이다.
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

/**
 * POST /api/questions/[id]/ask-neighbors 응답. 본문은 `{}` 로 보낸다(JSON 만 받는다).
 * 확인된 답을 받았지만 원하는 답이 아니었던 질문을 '이웃의 질문'에 올린다. 여러 번 눌러도 같다.
 */
export interface AskNeighborsResponse {
  questionId: string;
}

/* ===========================================================================
 * 본선 범위 — 로그인 · 질문 · 답변 · 승격
 *
 * 설계안 2.5의 API 목록과 prisma/schema.prisma 의 User · Question · Answer · Confirmation
 * 을 화면이 쓰는 모양으로 옮긴 초안이다. 담당자(희태 · 권섭) 검토 전이라 확정이 아니다.
 *
 * 공통 규칙
 * - 날짜는 ISO 8601 문자열이다 (`MatchedTask.verifiedAt` 과 같다).
 * - 이메일 · 비밀번호 해시는 어떤 응답에도 담지 않는다. 화면에는 닉네임만 나간다.
 * - 오류는 HTTP 상태 코드와 `ApiErrorResponse` 로 돌려준다. 성공 응답에 오류를 섞지 않는다.
 * ======================================================================== */

export type UserRole = 'MEMBER' | 'ADMIN';
export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'PROMOTED';

/** 모든 API 의 오류 응답. 상태 코드가 종류를 말하고, `error` 는 화면에 그대로 띄울 한글 문장이다. */
export interface ApiErrorResponse {
  error: string;
}

/* ---------- 인증 ---------- */

/**
 * 화면이 아는 로그인 사용자.
 * 세션 토큰 payload 에도 이 정도만 담는다 — 이메일 같은 개인정보는 넣지 않는다.
 */
export interface SessionUser {
  id: string;
  nickname: string;
  role: UserRole;
}

/**
 * POST /api/auth/signup 요청.
 *
 * 서버가 검증하는 한계 (화면의 입력 속성도 같은 값으로 맞춘다)
 * - email: 형식 검사, 대소문자 구분 없이 하나만 허용
 * - password: 8자 이상, 72바이트 이하 (bcrypt 는 72바이트 뒤를 잘라 버린다)
 * - nickname: 2~12자
 *
 * `role` 은 받지 않는다. 가입으로는 항상 MEMBER 이고, ADMIN 은 DB 에서 직접 올린다.
 */
export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

/** POST /api/auth/login 요청 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * POST /api/auth/signup (201) · POST /api/auth/login (200) 응답.
 * 세션은 응답 본문이 아니라 httpOnly 쿠키로 간다. 화면은 토큰을 만지지 않는다.
 */
export interface AuthResponse {
  user: SessionUser;
}

/**
 * GET /api/auth/me 응답.
 *
 * 로그인하지 않았으면 401 이 아니라 200 + `user: null` 이다.
 * "로그인 안 함"은 오류가 아니라 정상 상태라서, 화면이 오류 처리로 빠지지 않게 한다.
 */
export interface MeResponse {
  user: SessionUser | null;
}

/* ---------- 질문 · 답변 · 확인 ---------- */

/**
 * 답변 하나. 숨김 처리된(`isHidden`) 답변은 서버가 아예 내려주지 않는다.
 * 작성자 이메일은 없고 닉네임만 있다.
 */
export interface AnswerItem {
  id: string;
  questionId: string;
  authorNickname: string;
  text: string;
  /** "맞아요" 를 누른 사람 수. 승격 큐의 정렬 기준이 된다. */
  confirmationCount: number;
  /** 지금 로그인한 사람이 이미 눌렀는가. 로그인하지 않았으면 false. */
  confirmedByMe: boolean;
  /**
   * 지금 로그인한 사람이 쓴 답변인가. 로그인하지 않았으면 false.
   * 화면은 내 답변에 "맞아요" 버튼 대신 개수만 보여준다(누르면 403).
   * 닉네임은 겹칠 수 있어 화면에서 비교하지 않고, 작성자 id 는 내려주지 않는다.
   */
  authoredByMe: boolean;
  createdAt: string;
}

/**
 * 질문 하나와 그에 달린 답변들.
 *
 * `aiAnswer` 는 AI 가 답했을 때만 있다. `confidence` 가 'UNKNOWN' 이면 null 이다.
 * `ctxHousingType` · `ctxContractType` 은 질문한 사람의 상황 스냅샷이다.
 * 승격할 때 "이 질문은 원룸 사는 사람들이 물었다"는 조건 제안의 근거가 된다.
 * 상세 주소는 어디에도 없다.
 */
export interface QuestionItem {
  id: string;
  text: string;
  /** 로그인하지 않고 물었으면 null */
  askerNickname: string | null;
  ctxHousingType: HousingType | null;
  ctxContractType: ContractType | null;
  aiAnswer: string | null;
  confidence: Confidence;
  status: QuestionStatus;
  answers: AnswerItem[];
  createdAt: string;
}

/**
 * GET /api/questions 응답.
 *
 * 쿼리 `?status=OPEN|ANSWERED|PROMOTED` 로 거른다. 없으면 전부 최신순.
 * 답변을 각 질문에 포함해 내려준다. 질문 상세 API 를 따로 두지 않는다.
 */
export interface QuestionListResponse {
  questions: QuestionItem[];
}

/** POST /api/questions/[id]/answers 요청 (로그인 필요). 1~500자. */
export interface CreateAnswerRequest {
  text: string;
}

/** POST /api/questions/[id]/answers 응답 (201) */
export interface CreateAnswerResponse {
  answer: AnswerItem;
}

/**
 * POST /api/answers/[id]/confirm 응답 (로그인 필요).
 *
 * 같은 사람이 같은 답변에 두 번 눌러도 오류가 아니다. 이미 눌렀으면 그대로 현재 값을 돌려준다.
 * (DB 에 `@@unique([answerId, userId])` 가 있어 중복 행은 어차피 못 들어간다.)
 */
export interface ConfirmAnswerResponse {
  confirmationCount: number;
  confirmedByMe: true;
}

/* ---------- 승격 (ADMIN 전용) ---------- */

/**
 * 승격할 할 일의 내용. AI 초안도, 운영자가 고친 최종본도 이 모양이다.
 *
 * `TaskConditions` 를 그대로 쓴다. 노출 조건이 `lib/matching.ts` 와 같은 모양이어야
 * 발행하자마자 다음 사람의 목록에 같은 규칙으로 걸리기 때문이다.
 *
 * `dueOffsetDays` 는 이사일 기준 기한이 아니면 null 이다 (예: 음식물쓰레기는 기한이 없다).
 * AI 가 이 값을 틀리게 제안하기 쉬워서, 운영자가 눈으로 확인하는 자리가 이 필드다.
 */
export interface TaskDraft extends TaskConditions {
  title: string;
  why: string;
  howTo: string;
  category: TaskCategory;
  dueOffsetDays: number | null;
  linkUrl: string | null;
  placeName: string | null;
  placeAddress: string | null;
  placePhone: string | null;
}

/** 승격 큐의 한 줄. 확인 수가 많은 순으로 정렬해서 내려준다. */
export interface PromotionQueueItem {
  question: QuestionItem;
  /** 이 질문의 모든 답변에 달린 확인 수 합계. 정렬 기준일 뿐 승격 조건이 아니다. */
  totalConfirmations: number;
}

/** GET /api/admin/promotions 응답 (ADMIN). `status === 'ANSWERED'` 인 질문만 담긴다. */
export interface PromotionQueueResponse {
  items: PromotionQueueItem[];
}

/** POST /api/admin/promote/draft 요청 (ADMIN) */
export interface PromoteDraftRequest {
  questionId: string;
}

/**
 * POST /api/admin/promote/draft 응답.
 *
 * `draft` 가 null 이면 AI 호출이 실패한 것이다. 화면은 빈 양식을 띄우고 운영자가 직접 쓴다.
 * 승격이 AI 에 막히면 안 된다.
 */
export interface PromoteDraftResponse {
  draft: TaskDraft | null;
}

/**
 * POST /api/admin/promote 요청 (ADMIN).
 *
 * `sourceNote` 는 비어 있으면 거절한다. 모든 할 일은 출처가 있어야 하고(`CLAUDE.md`),
 * 승격된 할 일의 출처는 "누가 무엇을 근거로 확정했는가"이다.
 * `verifiedAt` 은 요청에 없다 — 서버가 발행 시각으로 채운다.
 */
export interface PromoteRequest {
  questionId: string;
  task: TaskDraft;
  sourceNote: string;
}

/**
 * POST /api/admin/promote 응답 (201). 질문은 `PROMOTED` 가 된다.
 *
 * `MatchedTask` 를 돌려주지 않는 이유: `daysLeft` 는 특정 사용자의 이사일을 기준으로
 * 계산되는 값인데, 발행 시점에는 기준이 될 사용자가 없다. 화면은 `/tasks/[id]` 로 이동해서 본다.
 */
export interface PromoteResponse {
  taskId: string;
}

/* ---------- 운영자 정리 (ADMIN 전용) ---------- */

/**
 * DELETE /api/admin/questions/[id] 응답 (ADMIN). 답변 · "맞아요"도 같이 지워진다.
 *
 * 오류: 401 로그인 필요 · 403 운영자 아님 · 404 없는 질문(이미 지워짐) · 409 할 일로 정리된 질문.
 * 404 · 409 를 받으면 화면은 목록을 다시 불러오면 된다.
 */
export interface DeleteQuestionResponse {
  id: string;
}

/** PATCH /api/admin/answers/[id] 요청 (ADMIN). true 숨기기 · false 되돌리기. */
export interface HideAnswerRequest {
  isHidden: boolean;
}

/**
 * PATCH /api/admin/answers/[id] 응답.
 *
 * 숨겨서 보이는 답변이 하나도 안 남으면 질문이 OPEN 으로 돌아가고, 되돌리면 ANSWERED 가 된다.
 * `questionStatus` 는 그 결과다. 숨긴 답변은 목록에 다시 나오지 않으므로, 되돌리기는 숨긴 직후
 * 화면이 들고 있는 답변 id 로만 할 수 있다("되돌리기" 버튼).
 *
 * 오류: 400 본문 형식 · 401 · 403 · 404 없는 답변.
 */
export interface HideAnswerResponse {
  answerId: string;
  isHidden: boolean;
  questionStatus: QuestionStatus;
}
