'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Masthead from '@/components/Masthead';
import TaskCard from '@/components/TaskCard';
import { useProfile } from '@/lib/useProfile';
import { useDone } from '@/lib/useDone';
import { progressPercent, splitByDone } from '@/lib/progress';
import { CATEGORY_LABEL, heroLabel } from '@/lib/labels';
import { groupByCategory, pickUrgent } from '@/lib/taskGroups';
import type { MatchResponse, MatchedTask } from '@/lib/types';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; tasks: MatchedTask[] }
  | { kind: 'failed' };

export default function TasksPage() {
  const router = useRouter();
  const { hydrated, profile } = useProfile();
  const doneIds = useDone();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    // 하이드레이션 전에는 프로필이 없는 게 아니라 아직 모르는 것이다. 튕기면 안 된다.
    if (!hydrated) return;
    if (!profile) {
      router.replace('/setup');
      return;
    }

    let alive = true;
    fetch('/api/tasks/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<MatchResponse>) : Promise.reject(res.status)))
      .then((data) => {
        if (alive) setState({ kind: 'ready', tasks: data.tasks });
      })
      .catch(() => {
        if (alive) setState({ kind: 'failed' });
      });

    return () => {
      alive = false;
    };
  }, [hydrated, profile, router]);

  // Neon 무료 티어는 5분간 요청이 없으면 컴퓨트를 정지시킨다.
  // 첫 조회가 1~3초 걸릴 수 있어 멈춘 것처럼 보이지 않게 한다.
  if (!profile || state.kind === 'loading') {
    return (
      <main>
        <Masthead profile={profile} />
        <p className="empty" role="status">
          불러오는 중입니다…
        </p>
      </main>
    );
  }

  if (state.kind === 'failed') {
    return (
      <main>
        <Masthead profile={profile} />
        <p className="empty">할 일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <nav className="nav">
          <Link href="/setup">상황 다시 입력하기</Link>
        </nav>
      </main>
    );
  }

  const { tasks } = state;
  // 끝낸 일은 히어로와 묶음에서 뺀다. 이미 한 일이 "지금 가장 급한 일"로 뜨면 안 된다.
  const { todo, done } = splitByDone(tasks, doneIds);
  const urgent = pickUrgent(todo);
  const hero = urgent ? heroLabel(urgent) : null;
  const groups = groupByCategory(todo);
  const percent = progressPercent(done.length, tasks.length);

  return (
    <main>
      <Masthead profile={profile} />

      {tasks.length > 0 && (
        <div className="progress">
          <p className="progress__text">
            {tasks.length}건 중 <strong>{done.length}건</strong> 완료
          </p>
          <div
            className="progress__bar"
            role="progressbar"
            aria-label="할 일 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="progress__fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {/*
        가장 급한 항목 하나를 끌어올린다. 아래 묶음에도 같은 항목이 다시 나오지만
        목록을 훑기 전에 "지금 뭐부터"를 먼저 답해 주는 자리라 중복을 둔다.
      */}
      {urgent && hero && (
        <Link
          href={`/tasks/${urgent.id}`}
          className={`hero${hero.overdue ? ' overdue' : ''}`}
          data-category={urgent.category}
        >
          <span className="hero__eyebrow">지금 가장 급한 일</span>
          <span className="hero__num">{hero.num}</span>
          <span className="hero__cap">{hero.cap}</span>
          <span className="hero__cta">{hero.cta} →</span>
        </Link>
      )}

      {tasks.length === 0 && <p className="empty">해당하는 할 일이 없습니다.</p>}

      {tasks.length > 0 && todo.length === 0 && (
        <p className="all-done">해당하는 할 일을 모두 끝냈습니다.</p>
      )}

      {groups.map((group) => (
        <section key={group.category} className="group" data-category={group.category}>
          <h2 className="group__head">
            <span className="group__dot" aria-hidden="true" />
            {CATEGORY_LABEL[group.category]}
            <span className="group__count">{group.tasks.length}건</span>
          </h2>
          {group.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      ))}

      {done.length > 0 && (
        <section className="group group--done">
          <h2 className="group__head">
            끝낸 일
            <span className="group__count">{done.length}건</span>
          </h2>
          {done.map((task) => (
            <TaskCard key={task.id} task={task} done />
          ))}
        </section>
      )}

      <nav className="nav">
        <Link href="/ask">궁금한 게 있나요? 질문하기</Link>
        <Link href="/setup">상황 다시 입력하기</Link>
      </nav>
    </main>
  );
}
