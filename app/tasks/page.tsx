'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TaskCard from '@/components/TaskCard';
import { loadProfile } from '@/lib/profile';
import type { MatchResponse, MatchedTask, Profile } from '@/lib/types';

const CONTRACT_LABEL: Record<Profile['contractType'], string> = {
  MONTHLY: '월세',
  JEONSE: '전세',
  DORM_FEE: '기숙사비',
  OWNED: '자가',
};

const HOUSING_LABEL: Record<Profile['housingType'], string> = {
  ONE_ROOM: '원룸',
  OFFICETEL: '오피스텔',
  DORM: '기숙사',
  APARTMENT: '아파트',
  VILLA: '빌라',
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; tasks: MatchedTask[] }
  | { kind: 'failed' };

export default function TasksPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const saved = loadProfile();
    if (!saved) {
      router.replace('/setup');
      return;
    }
    setProfile(saved);

    let alive = true;
    fetch('/api/tasks/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: saved }),
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
  }, [router]);

  // Neon 무료 티어는 5분간 요청이 없으면 컴퓨트를 정지시킨다.
  // 첫 조회가 1~3초 걸릴 수 있어 멈춘 것처럼 보이지 않게 한다.
  if (!profile || state.kind === 'loading') {
    return (
      <main>
        <h1>내 할 일</h1>
        <p className="lead">불러오는 중입니다…</p>
      </main>
    );
  }

  if (state.kind === 'failed') {
    return (
      <main>
        <h1>내 할 일</h1>
        <p className="empty">할 일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <nav className="nav">
          <Link href="/setup">상황 다시 입력하기</Link>
        </nav>
      </main>
    );
  }

  return (
    <main>
      <h1>내 할 일</h1>

      <p className="summary">
        {HOUSING_LABEL[profile.housingType]} · {CONTRACT_LABEL[profile.contractType]} 기준{' '}
        {state.tasks.length}건
      </p>

      {state.tasks.length === 0 ? (
        <p className="empty">해당하는 할 일이 없습니다.</p>
      ) : (
        state.tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}

      <nav className="nav">
        <Link href="/setup">상황 다시 입력하기</Link>
      </nav>
    </main>
  );
}
