'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout, useSession } from '@/lib/useSession';

/**
 * 제호 오른쪽의 로그인 상태. 로그인했으면 닉네임과 로그아웃, 아니면 로그인 링크.
 * 확인 전에는 자리만 잡아 둔다 — 글자가 바뀌며 제호가 흔들리지 않게.
 */
export default function AccountMenu() {
  const { loaded, user } = useSession();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);

  if (!loaded) return <span className="account" aria-hidden="true" />;

  if (!user) {
    return (
      <Link className="account account__link" href={`/login?next=${encodeURIComponent(pathname)}`}>
        로그인
      </Link>
    );
  }

  async function handleLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <span className="account">
      <span className="account__name">{user.nickname} 님</span>
      <button type="button" className="account__logout" onClick={handleLogout} disabled={leaving}>
        로그아웃
      </button>
    </span>
  );
}
