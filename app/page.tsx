'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadProfile } from '@/lib/profile';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(loadProfile() ? '/tasks' : '/setup');
  }, [router]);

  return (
    <main>
      <p className="lead">불러오는 중입니다…</p>
    </main>
  );
}
