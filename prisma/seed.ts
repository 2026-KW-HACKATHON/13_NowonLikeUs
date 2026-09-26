import { prisma } from '../lib/db';
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

async function main() {
  assertSourced();

  await prisma.task.deleteMany({ where: { source: 'SEED' } });

  for (const task of seedTasks) {
    await prisma.task.create({ data: task });
  }

  console.log(`시드 할 일 ${seedTasks.length}건을 넣었습니다.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());