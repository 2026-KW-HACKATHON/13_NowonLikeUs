import { prisma } from '@/lib/db';
import { readJsonBody, requireUser } from '@/lib/auth';
import { validateAnswer } from '@/lib/answerValidation';
import { answerSelect, toAnswerItem } from '@/lib/questionView';
import { createLimiter, limitByIp, RATE_LIMITS, tooManyRequests, windowStart } from '@/lib/rateLimit';
import type { ApiErrorResponse, CreateAnswerResponse } from '@/lib/types';

const ipLimiter = createLimiter(RATE_LIMITS.answerPerIp);

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * POST /api/questions/[id]/answers — 주민이 질문에 답변을 단다 (로그인 필요).
 * 첫 답변이 달리면 질문이 OPEN → ANSWERED 가 되어 운영자 승격 큐에 들어간다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = limitByIp(ipLimiter, request);
  if (limited) return limited;

  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateAnswer(body);
  if (!input.ok) return error(input.error, 400);

  const { id } = await params;
  // 계정별 최근 답변 수는 DB 에서 세므로 인스턴스가 여러 개여도 같은 값을 본다. 왕복을 늘리지 않게 같이 보낸다.
  const [recentAnswers, question] = await Promise.all([
    prisma.answer.count({ where: { authorId: auth.id, createdAt: { gte: windowStart(RATE_LIMITS.answerPerUser) } } }),
    prisma.question.findUnique({ where: { id }, select: { status: true } }),
  ]);
  if (recentAnswers >= RATE_LIMITS.answerPerUser.limit) return tooManyRequests(RATE_LIMITS.answerPerUser.windowMs / 1000);
  if (!question) return error('없는 질문입니다.', 404);
  if (question.status === 'PROMOTED') return error('이미 할 일로 정리된 질문입니다.', 409);

  // 중간에 분기가 없어서 배치 트랜잭션으로 한 번에 보낸다. 둘 중 하나가 실패하면 둘 다 되돌아간다.
  // 인터랙티브 트랜잭션(async (tx) => ...)은 쿼리마다 DB 를 오가서, 한국 → us-east-2 왕복이 쌓이면
  // 기본 제한 5초를 넘겨 500("Transaction not found")이 났다.
  const [created] = await prisma.$transaction([
    prisma.answer.create({
      data: { questionId: id, authorId: auth.id, text: input.value.text },
      select: answerSelect(auth.id),
    }),
    // 조건부 갱신이라 동시에 여러 답변이 달려도 결과가 같다. 이미 ANSWERED 면 그대로 둔다.
    prisma.question.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'ANSWERED' } }),
  ]);

  // 방금 내가 쓴 답변이므로 authoredByMe 는 항상 true 다.
  const response: CreateAnswerResponse = { answer: toAnswerItem(created, auth.id) };
  return Response.json(response, { status: 201 });
}
