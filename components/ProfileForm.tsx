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

// 조사 결과 구역별로 쓰레기 배출 요일이 갈리지 않으면 이 선택은 없앤다.
const ZONES = ['월계1동'];

export default function ProfileForm({
  initial,
  onSubmit,
}: {
  initial?: Profile | null;
  onSubmit: (profile: Profile) => void;
}) {
  const [zone, setZone] = useState(initial?.zone ?? ZONES[0]);
  const [housingType, setHousingType] = useState<HousingType>(initial?.housingType ?? 'ONE_ROOM');
  const [contractType, setContractType] = useState<ContractType>(initial?.contractType ?? 'MONTHLY');
  const [moveInDate, setMoveInDate] = useState(initial?.moveInDate ?? '');
  const [hasCar, setHasCar] = useState(initial?.hasCar ?? false);
  const [hasPet, setHasPet] = useState(initial?.hasPet ?? false);
  const [isStudent, setIsStudent] = useState(initial?.isStudent ?? false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!moveInDate) return;
    onSubmit({ zone, housingType, contractType, moveInDate, hasCar, hasPet, isStudent });
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>어떤 집에 사시나요?</legend>
        <div className="choices">
          {HOUSING.map((option) => (
            <label key={option.value} className="choice">
              <input
                type="radio"
                name="housingType"
                checked={housingType === option.value}
                onChange={() => setHousingType(option.value)}
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
        상세 주소는 받지 않습니다. 입력한 내용은 이 브라우저에만 저장되고 서버로 보내지 않습니다.
      </p>
    </form>
  );
}
