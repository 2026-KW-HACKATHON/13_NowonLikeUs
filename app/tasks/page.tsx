'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TaskCard from '@/components/TaskCard';
import { loadProfile } from '@/lib/profile';
import { mockMatch } from '@/lib/mock-tasks';
import type { MatchedTask, Profile } from '@/lib/types';

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

export default function TasksPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MatchedTask[] | null>(null);

  useEffect(() => {
    const saved = loadProfile();
    if (!saved) {
      router.replace('/setup');
      return;
    }
    setProfile(saved);
    // TODO: /api/tasks/match 가 붙으면 목 데이터를 교체한다.
    setTasks(mockMatch(saved));
  }, [router]);

  if (!profile || tasks === null) {
    return (
      <main>
        <h1>내 할 일</h1>
        <p className="lead">불러오는 중입니다…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>내 할 일</h1>

      <p className="summary">
        {HOUSING_LABEL[profile.housingType]} · {CONTRACT_LABEL[profile.contractType]} 기준 {tasks.length}건
      </p>

      {tasks.length === 0 ? (
        <p className="empty">해당하는 할 일이 없습니다.</p>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}

      <nav className="nav">
        <Link href="/setup">상황 다시 입력하기</Link>
      </nav>
    </main>
  );
}
