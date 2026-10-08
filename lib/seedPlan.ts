/*
 * 시드를 다시 돌릴 때 무엇을 고치고 · 만들고 · 지울지 정하는 순수 함수. DB 를 부르지 않는다.
 *
 * 예전에는 SEED 할 일을 전부 지우고 새로 만들어서, 다시 시딩할 때마다 할 일 id 가 모두 바뀌었다.
 * 그러면 브라우저에 저장된 완료 체크, 공유한 /tasks/[id] 링크, 질문의 근거 id(sourceIds)가 전부 끊긴다.
 * 이제는 제목으로 기존 행을 찾아 내용만 고친다 — id 가 유지된다.
 */

export interface ExistingSeedRow {
  id: string;
  title: string;
}

export interface SeedPlan {
  /** 같은 제목의 기존 행 — id 를 유지한 채 내용을 고친다. */
  update: ExistingSeedRow[];
  /** 기존에 없는 제목 — 새로 만든다. */
  create: string[];
  /** 시드 데이터에서 빠진 제목, 또는 같은 제목이 두 번 이상 있던 행 — 지운다. */
  remove: string[];
}

/** 제목이 키라서 시드 데이터 안에서 제목이 겹치면 안 된다. 겹치는 제목 목록(없으면 빈 배열). */
export function duplicateTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const title of titles) {
    if (seen.has(title)) dup.add(title);
    seen.add(title);
  }
  return [...dup];
}

/**
 * `existing` 은 오래된 순으로 넘긴다. 같은 제목이 여러 행이면 가장 오래된 행을 남긴다
 * (그 id 가 가장 오래 쓰였을 가능성이 높다).
 */
export function planSeed(existing: ExistingSeedRow[], titles: string[]): SeedPlan {
  const dup = duplicateTitles(titles);
  if (dup.length > 0) throw new Error(`시드 데이터에 같은 제목이 있습니다: ${dup.join(', ')}`);

  const wanted = new Set(titles);
  const kept = new Map<string, ExistingSeedRow>();
  const remove: string[] = [];

  for (const row of existing) {
    if (wanted.has(row.title) && !kept.has(row.title)) kept.set(row.title, row);
    else remove.push(row.id);
  }

  const update: ExistingSeedRow[] = [];
  const create: string[] = [];
  for (const title of titles) {
    const row = kept.get(title);
    if (row) update.push(row);
    else create.push(title);
  }

  return { update, create, remove };
}
