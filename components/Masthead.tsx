import { CONTRACT_LABEL, HOUSING_LABEL, moveInLabel } from '@/lib/labels';
import type { Profile } from '@/lib/types';

/** 제호와 지금 보고 있는 조건. 목록 · 질문 화면 맨 위에 똑같이 붙는다. */
export default function Masthead({ profile }: { profile: Profile | null }) {
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
