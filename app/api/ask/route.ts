import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { askGemini } from '@/lib/gemini';
import { groundAnswer } from '@/lib/grounding';
import { CONTRACT_LABEL, HOUSING_LABEL } from '@/lib/labels';
import { matchesProfile } from '@/lib/matching';
import { keywordSearch } from '@/lib/search';
import { toMatchedTask } from '@/lib/taskView';
import type { AskResponse, Profile } from '@/lib/types';

/** 한 번에 보여줄 원문 카드 수. AI 모드와 키워드 검색 모두 같다. */
const MAX_TASKS = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 질문자 id. 로그인했고 그 계정이 지금도 DB 에 있을 때만 돌려준다(자체 DB 에만 저장, AI 요청에는 넣지 않는다).
 * 세션을 못 읽거나, 지운 계정의 쿠키가 남아 있으면 null — 외래키 위반으로 질문 자체가 막히면 안 된다.
 * 질문은 원래 로그인 없이 쓰는 기능이다.
 */
async function resolveAskerId(): Promise<string | null> {
  const session = await getSessionUser().catch(() => null);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } }).catch(() => null);
  return user?.id ?? null;
}

/** 외부 AI는 명시 허용 시에만 호출한다. 질문과 최소 상황은 자체 DB에 저장한다. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000) {
    return Response.json({ error: '질문을 1~1000자로 입력해 주세요.' }, { status: 400 });
  }

  let profile: Omit<Profile, 'zone'> | undefined;
  if (body.profile !== undefined) {
    const p = body.profile;
    if (!isRecord(p) || typeof p.housingType !== 'string' || !Object.hasOwn(HOUSING_LABEL, p.housingType)
      || typeof p.contractType !== 'string' || !Object.hasOwn(CONTRACT_LABEL, p.contractType) || !isDate(p.moveInDate)) {
      return Response.json({ error: '주거형태, 계약형태, 이사일을 확인해 주세요.' }, { status: 400 });
    }
    profile = {
      housingType: p.housingType as Profile['housingType'],
      contractType: p.contractType as Profile['contractType'],
      moveInDate: p.moveInDate,
      hasCar: p.hasCar === true,
      hasPet: p.hasPet === true,
      isStudent: p.isStudent === true,
    };
  }

  const text = body.text.trim();
  const askerId = await resolveAskerId();
  try {
    const rows = await prisma.task.findMany({ where: { isPublished: true } });
    const candidates = profile
      ? rows.filter((task) => matchesProfile(task, { ...profile, zone: '' }))
      : rows;
    // 키가 있어도 기본값은 전송 금지. 유료 프로젝트·고지 정책 확인 후에만 서버에서 활성화한다.
    const ai = process.env.GEMINI_ALLOW_USER_INPUT === 'true' && candidates.length > 0
      ? await askGemini(text, candidates.map((t) => `task:${t.id} | ${t.title} | ${t.why} | ${t.howTo}`).join('\n'),
        profile ? `주거형태: ${HOUSING_LABEL[profile.housingType]}, 계약형태: ${CONTRACT_LABEL[profile.contractType]}` : '')
      : null;
    const byId = new Map(candidates.map((t) => [`task:${t.id}`, t]));
    const result = ai ? groundAnswer(ai, new Set(byId.keys())) : null;
    // 서버 검증 후 UNKNOWN이면 AI 결과를 버리고 키워드 검색으로 넘어간다. DB에는 UNKNOWN과 빈 근거만 남는다.
    const grounded = result && result.confidence !== 'UNKNOWN' ? result : null;
    // AI가 고른 순서를 유지하고, 화면에 보여준 카드만 근거로 저장한다.
    const sourceIds = grounded ? grounded.validSourceIds.slice(0, MAX_TASKS) : [];
    const selected = grounded
      ? sourceIds.flatMap((id) => byId.get(id) ?? [])
      : keywordSearch(candidates, text, MAX_TASKS);
    const answer = grounded?.answer ?? null;
    const confidence = grounded?.confidence ?? 'UNKNOWN';
    const question = await prisma.question.create({
      data: {
        text, aiAnswer: answer, confidence, sourceIds,
        askerId,
        ctxHousingType: profile?.housingType ?? null,
        ctxContractType: profile?.contractType ?? null,
      },
      select: { id: true },
    });
    const today = new Date();
    const response: AskResponse = {
      mode: grounded ? 'AI' : 'FALLBACK', answer, confidence, questionId: question.id,
      tasks: selected.map((t) => toMatchedTask(t, profile?.moveInDate ?? null, today)),
    };
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // 질문 본문·프로필·DB 접속 정보는 로그나 오류 응답에 노출하지 않는다.
    return Response.json({ error: '질문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}
