'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';
import { loadProfile, saveProfile } from '@/lib/profile';
import type { Profile } from '@/lib/types';

export default function SetupPage() {
  const router = useRouter();
  const [initial, setInitial] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  // localStorage 는 서버에 없으므로 마운트 후에 읽는다.
  useEffect(() => {
    setInitial(loadProfile());
    setReady(true);
  }, []);

  function handleSubmit(profile: Profile) {
    saveProfile(profile);
    router.push('/tasks');
  }

  return (
    <main>
      <h1>월계는 처음이라</h1>
      <p className="lead">
        몇 가지만 알려주시면 지금 해야 할 일만 골라서 보여드립니다.
      </p>
      {ready && <ProfileForm initial={initial} onSubmit={handleSubmit} />}
    </main>
  );
}
