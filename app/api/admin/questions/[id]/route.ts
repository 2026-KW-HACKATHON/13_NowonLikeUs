import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { ApiErrorResponse, DeleteQuestionResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * DELETE /api/admin/questions/[id] — 운영자가 질문을 지운다 (ADMIN, role 은 DB 재조회).
 *
 * 질문은 로그인 없이 올라오고 표지 · '이웃의 질문'에 바로 보인다. 장난 · 욕설 · 개인정보가 담긴 질문을
 * 내리는 수단이다. 답변과 "맞아요"도 같이 지워진다(DB 의 ON DELETE CASCADE).
 *
 * 할 일로 정리된(PROMOTED) 질문은 지우지 않는다(409) — 발행된 할 일이 이 질문을 출처로 가리킨다.
 * 본문이 없어 Content-Type 검사의 예외다. DELETE 는 SameSite=Lax 쿠키가 다른 사이트에서 실리지 않는다.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;

  // 조건부 삭제 — 확인과 삭제 사이에 다른 운영자가 승격해도 PROMOTED 질문은 지워지지 않는다.
  const { count } = await prisma.question.deleteMany({ where: { id, status: { not: 'PROMOTED' } } });
  if (count === 0) {
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return error('없는 질문입니다.', 404);
    return error('할 일로 정리된 질문은 지울 수 없습니다.', 409);
  }

  const response: DeleteQuestionResponse = { id };
  return Response.json(response);
}
