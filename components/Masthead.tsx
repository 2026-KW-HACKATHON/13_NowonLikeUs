import Image from 'next/image';
import Link from 'next/link';
import AccountMenu from '@/components/AccountMenu';
import { CONTRACT_LABEL, HOUSING_LABEL, moveInLabel } from '@/lib/labels';
import type { Profile } from '@/lib/types';

/**
 * 제호와 지금 보고 있는 조건, 로그인 상태. 모든 화면 맨 위에 똑같이 붙는다.
 * 제호를 누르면 표지(/)로 간다. 집 아이콘은 바로 옆 글자와 같은 뜻이라 스크린리더에는 읽히지 않게 alt 를 비운다.
 * 로그인 · 가입 화면에서는 `account={false}` — 거기서 "로그인" 링크는 제자리로 가는 링크다.
 */
export default function Masthead({ profile, account = true }: { profile: Profile | null; account?: boolean }) {
  return (
    <header className="masthead">
      <div className="masthead__top">
        <p className="masthead__brand">
          <Link href="/" className="masthead__home">
            <Image src="/logo-mark.svg" alt="" width={30} height={30} className="masthead__mark" unoptimized />
            월계는 처음이라
          </Link>
        </p>
        {account && <AccountMenu />}
      </div>
      {profile && (
        <p className="masthead__meta">
          {HOUSING_LABEL[profile.housingType]} · {CONTRACT_LABEL[profile.contractType]} ·{' '}
          {moveInLabel(profile.moveInDate)} 이사
        </p>
      )}
    </header>
  );
}
