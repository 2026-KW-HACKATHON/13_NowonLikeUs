import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminTaskListResponse } from '@/lib/types';

/**
 * GET /api/admin/tasks — 발행된 할 일 전부의 제목 · 분류 · 노출 조건 (ADMIN, role 은 DB 재조회).
 *
 * 승격 화면(components/TaskOverlapPanel.tsx)이 "이 조건의 사람에게 이미 보이는 할 일"을 보여 주는 데 쓴다.
 * 시드 할 일과 승격된 할 일을 가리지 않는다 — 둘 다 다음 사람 목록에 뜬다.
 * 내린(isPublished: false) 할 일은 목록에 안 뜨므로 뺀다. 할 일이 수십 건이라 페이지를 나누지 않는다.
 *
 * 화면이 쓰는 값만 꺼낸다. 이유 · 방법 · 장소 · 출처는 내리지 않는다.
 * 순서는 화면이 다시 정렬하지만, 응답이 매번 같도록 만든 순으로 고정한다.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const tasks = await prisma.task.findMany({
    where: { isPublished: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      category: true,
      housingTypes: true,
      contractTypes: true,
      requiresCar: true,
      requiresPet: true,
      studentOnly: true,
    },
  });

  const response: AdminTaskListResponse = { tasks };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
