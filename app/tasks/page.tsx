'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TaskCard from '@/components/TaskCard';
import { useProfile } from '@/lib/useProfile';
import {
  CATEGORY_LABEL,
  CONTRACT_LABEL,
  HOUSING_LABEL,
  heroLabel,
  moveInLabel,
} from '@/lib/labels';
import { groupByCategory, pickUrgent } from '@/lib/taskGroups';
import type { MatchResponse, MatchedTask, Profile } from '@/lib/types';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; tasks: MatchedTask[] }
  | { kind: 'failed' };

/** 제호와 지금 보고 있는 조건. 어떤 상태에서도 화면 맨 위에 똑같이 붙는다. */
function Masthead({ profile }: { profile: Profile | null }) {
  return (
    <header className="masthead">
      <p className="masthead__brand">월계는 처음이라</p>
      {profile && (
        <p className="masthead__meta">
          {HOUSING_LABEL[profile.housingType]} · {CONTRACT_LABEL[profile.contractType]} ·{' '}
          {moveInLabel(profile.moveInDate)} 이사
        </p>
      )}
    </header>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const { hydrated, profile } = useProfile();
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
  const urgent = pickUrgent(tasks);
  const hero = urgent ? heroLabel(urgent) : null;
  const groups = groupByCategory(tasks);

  return (
    <main>
      <Masthead profile={profile} />

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

      {tasks.length === 0 ? (
        <p className="empty">해당하는 할 일이 없습니다.</p>
      ) : (
        groups.map((group) => (
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
        ))
      )}

      <nav className="nav">
        <Link href="/setup">상황 다시 입력하기</Link>
      </nav>
    </main>
  );
}
