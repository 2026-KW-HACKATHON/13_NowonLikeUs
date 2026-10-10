'use client';

import { useState } from 'react';
import type { ContractType, HousingType, Profile } from '@/lib/types';

const HOUSING: { value: HousingType; label: string }[] = [
  { value: 'ONE_ROOM', label: '원룸' },
  { value: 'OFFICETEL', label: '오피스텔' },
  { value: 'DORM', label: '기숙사' },
  { value: 'APARTMENT', label: '아파트' },
  { value: 'VILLA', label: '빌라' },
];

const CONTRACT: { value: ContractType; label: string }[] = [
  { value: 'MONTHLY', label: '월세' },
  { value: 'JEONSE', label: '전세' },
  { value: 'DORM_FEE', label: '기숙사비' },
  { value: 'OWNED', label: '자가' },
];

// 조사 결과 월계1동 내부 세부 구역 구분은 공식 자료에서 확인되지 않았다.
// 구역별로 갈리는 규정이 나오면 그때 선택 UI 를 만든다.
const ZONE = '월계1동';

export default function ProfileForm({
  initial,
  onSubmit,
}: {
  initial?: Profile | null;
  onSubmit: (profile: Profile) => void;
}) {
  // 집 · 계약 형태는 처음에 아무것도 고르지 않은 상태로 둔다. 미리 골라 두면 기숙사생이 날짜만 넣고
  // 넘어가도 원룸 · 월세 목록을 받는다. 결과가 이 두 값으로 갈리므로 꼭 직접 고르게 한다.
  const [housingType, setHousingType] = useState<HousingType | null>(initial?.housingType ?? null);
  const [contractType, setContractType] = useState<ContractType | null>(initial?.contractType ?? null);
  const [moveInDate, setMoveInDate] = useState(initial?.moveInDate ?? '');
  const [hasCar, setHasCar] = useState(initial?.hasCar ?? false);
  const [hasPet, setHasPet] = useState(initial?.hasPet ?? false);
  const [isStudent, setIsStudent] = useState(initial?.isStudent ?? false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!housingType || !contractType || !moveInDate) return;
    onSubmit({ zone: ZONE, housingType, contractType, moveInDate, hasCar, hasPet, isStudent });
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>어떤 집에 사시나요?</legend>
        <div className="choices">
          {HOUSING.map((option) => (
            <label key={option.value} className="choice">
              {/* 같은 name 의 라디오 하나에만 required 가 있어도 묶음 전체가 필수가 된다. 날짜 칸과 같은 브라우저 안내가 뜬다. */}
              <input
                type="radio"
                name="housingType"
                checked={housingType === option.value}
                onChange={() => setHousingType(option.value)}
                required
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>계약 형태는요?</legend>
        <div className="choices">
          {CONTRACT.map((option) => (
            <label key={option.value} className="choice">
              <input
                type="radio"
                name="contractType"
                checked={contractType === option.value}
                onChange={() => setContractType(option.value)}
                required
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>언제 이사하셨나요? (예정일도 괜찮습니다)</span>
        <input
          type="date"
          value={moveInDate}
          onChange={(event) => setMoveInDate(event.target.value)}
          required
        />
      </label>

      <fieldset>
        <legend>해당되는 것이 있나요?</legend>
        <div className="choices">
          <label className="choice">
            <input type="checkbox" checked={hasCar} onChange={(e) => setHasCar(e.target.checked)} />
            차가 있어요
          </label>
          <label className="choice">
            <input type="checkbox" checked={hasPet} onChange={(e) => setHasPet(e.target.checked)} />
            반려동물과 살아요
          </label>
          <label className="choice">
            <input type="checkbox" checked={isStudent} onChange={(e) => setIsStudent(e.target.checked)} />
            학생이에요
          </label>
        </div>
      </fieldset>

      <button type="submit">내 할 일 보기</button>

      <p className="note">
        상세 주소는 받지 않습니다. 상황 입력은 이 브라우저에 저장되며, 할 일 조회를 위해
        서버로 전송되지만 조회 시에는 저장하지 않습니다. 별도로 질문을 제출하면 질문 내용과
        주거형태·계약형태가 서버에 저장됩니다. 질문에 이름·연락처·상세 주소를 적지 마세요.
      </p>
    </form>
  );
}
