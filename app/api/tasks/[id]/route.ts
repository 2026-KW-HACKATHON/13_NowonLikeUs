import { prisma } from '@/lib/db';
import { toMatchedTask } from '@/lib/taskView';
import type { TaskDetailResponse } from '@/lib/types';

/** GET /api/tasks/[id]?moveInDate=YYYY-MM-DD — 할 일 하나. 이사일을 주면 남은 날짜도 계산한다. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moveInDate = new URL(request.url).searchParams.get('moveInDate');

  const t = await prisma.task.findUnique({ where: { id } });
  if (!t || !t.isPublished) {
    return Response.json({ error: '없는 항목입니다.' }, { status: 404 });
  }

  const response: TaskDetailResponse = { task: toMatchedTask(t, moveInDate, new Date()) };
  return Response.json(response);
}