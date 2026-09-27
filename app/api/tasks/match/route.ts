import { prisma } from '@/lib/db';
import { filterByProfile } from '@/lib/matching';
import { byDueDate, toMatchedTask } from '@/lib/taskView';
import type { MatchRequest, MatchResponse } from '@/lib/types';

/** POST /api/tasks/match — 프로필을 받아 해당하는 할 일만 기한순으로 돌려준다. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as MatchRequest | null;
  const profile = body?.profile;
  if (!profile?.moveInDate) {
    return Response.json({ error: '프로필이 필요합니다.' }, { status: 400 });
  }

  const rows = await prisma.task.findMany({ where: { isPublished: true } });
  const today = new Date();

  const tasks = filterByProfile(rows, profile)
    .map((t) => toMatchedTask(t, profile.moveInDate, today))
    .sort(byDueDate);

  const response: MatchResponse = { tasks };
  return Response.json(response);
}