'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/useProfile';

export default function Home() {
  const router = useRouter();
  const { hydrated, profile } = useProfile();

  useEffect(() => {
    // 하이드레이션 전에는 프로필 유무를 모른다. 알고 나서 보낸다.
    if (!hydrated) return;
    router.replace(profile ? '/tasks' : '/setup');
  }, [hydrated, profile, router]);

  return (
    <main>
      <p className="empty" role="status">
        불러오는 중입니다…
      </p>
    </main>
  );
}
