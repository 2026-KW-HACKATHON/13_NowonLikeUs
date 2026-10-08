import { prisma } from '../lib/db';
import { planSeed } from '../lib/seedPlan';
import { seedTasks } from './seed-data';

/**
 * 출처와 확인 날짜가 없는 항목은 넣지 않는다.
 * "정보의 출처는 항상 사람"이라는 원칙을 시딩 단계에서 강제한다.
 */
function assertSourced(): void {
  const bad = seedTasks.filter(
    (t) => !t.sourceNote || t.sourceNote.trim() === '' || !t.verifiedAt,
  );
  if (bad.length > 0) {
    const titles = bad.map((t) => t.title).join(', ');
    throw new Error(`sourceNote 또는 verifiedAt이 비어 있는 항목이 있습니다: ${titles}`);
  }
}

/**
 * 다시 돌려도 할 일 id 가 바뀌지 않는다 — 제목이 같은 기존 행은 내용만 고친다.
 * 제목을 바꾸면 새 할 일로 취급되니(옛 id 는 지워진다), 제목은 되도록 그대로 두고 내용을 고친다.
 * 승격으로 생긴 할 일(source = PROMOTED)은 건드리지 않는다.
 *
 * 트랜잭션으로 묶지 않는다 — 한국 → us-east-2 왕복이 쌓이면 시간 제한에 걸린다. 대신 지우기를 맨 마지막에 해서,
 * 중간에 실패해도 할 일 목록이 비는 일은 없다(예전 방식은 전부 지운 뒤 만들어서, 실패하면 목록이 비었다).
 */
async function main() {
  assertSourced();

  const existing = await prisma.task.findMany({
    where: { source: 'SEED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  });
  const plan = planSeed(existing, seedTasks.map((t) => t.title));
  const byTitle = new Map(seedTasks.map((t) => [t.title, t]));

  for (const row of plan.update) {
    await prisma.task.update({ where: { id: row.id }, data: byTitle.get(row.title)! });
  }
  for (const title of plan.create) {
    await prisma.task.create({ data: byTitle.get(title)! });
  }
  if (plan.remove.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: plan.remove }, source: 'SEED' } });
  }

  console.log(
    `시드 할 일 ${seedTasks.length}건 — 고침 ${plan.update.length} · 새로 만듦 ${plan.create.length} · 지움 ${plan.remove.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
