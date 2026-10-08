'use client';

import { useRouter } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';
import { saveProfile } from '@/lib/profile';
import { useProfile } from '@/lib/useProfile';
import type { Profile } from '@/lib/types';

export default function SetupPage() {
  const router = useRouter();
  // localStorage 는 서버에 없다. 하이드레이션 전에는 폼을 그리지 않는다.
  const { hydrated, profile } = useProfile();

  function handleSubmit(next: Profile) {
    saveProfile(next);
    router.push('/tasks');
  }

  return (
    <main>
      <h1 className="page-title">월계는 처음이라</h1>
      <p className="lead">
        몇 가지만 알려주시면 지금 해야 할 일만 골라서 보여드립니다.
      </p>
      {hydrated && <ProfileForm initial={profile} onSubmit={handleSubmit} />}
    </main>
  );
}
