import { describe, expect, it } from 'vitest';
import { fromAnswers, isMoveInDeadline, sanitizeDraft, type DraftSource } from '@/lib/promotionDraft';

const source: DraftSource = {
  question: '전입신고는 언제까지 해야 하나요? 30일이라던데',
  answers: ['이사하고 14일 안에 월계1동 주민센터(02-2116-0000)에서 하면 돼요. https://www.gov.kr 에서도 됩니다.'],
  askerHousingType: 'ONE_ROOM',
  askerContractType: 'MONTHLY',
};

const raw = {
  title: '전입신고 하기',
  why: '14일이 지나면 과태료가 나올 수 있습니다.',
  howTo: '주민센터 방문 또는 https://www.gov.kr 에서 신청',
  category: 'ADMIN',
  dueOffsetDays: 14,
  linkUrl: 'https://www.gov.kr',
  placeName: '월계1동 주민센터',
  placeAddress: null,
  placePhone: '02-2116-0000',
  housingTypes: ['ONE_ROOM'],
  contractTypes: ['MONTHLY'],
};

describe('fromAnswers', () => {
  it('답변에 있는 숫자 · 링크만 쓰면 true', () => {
    expect(fromAnswers('14일 안에 https://www.gov.kr', '이사하고 14일 https://www.gov.kr')).toBe(true);
  });
  it('답변에 없는 숫자가 있으면 false', () => {
    expect(fromAnswers('과태료 50만원', '이사하고 14일')).toBe(false);
  });
  it('숫자 없는 링크도 답변에 없으면 false', () => {
    expect(fromAnswers('www.example.com 에서 신청', '이사하고 14일')).toBe(false);
  });
});

describe('isMoveInDeadline', () => {
  it('같은 답변에 이사 · 전입과 N일이 함께 있으면 true', () => {
    expect(isMoveInDeadline(14, ['전입은 이사하고 14일 안에'])).toBe(true);
  });
  it('이사일과 상관없는 일수는 false', () => {
    expect(isMoveInDeadline(3, ['음식물은 3일마다 수거해요'])).toBe(false);
  });
  it('숫자가 다른 수의 일부면 false', () => {
    expect(isMoveInDeadline(4, ['이사하고 14일 안에'])).toBe(false);
  });
});

describe('sanitizeDraft', () => {
  it('답변과 맞는 초안은 그대로 채운다', () => {
    expect(sanitizeDraft(raw, source)).toEqual({ ...raw, requiresCar: false, requiresPet: false, studentOnly: false });
  });

  it('답변에 없는 숫자가 섞인 문장은 비운다', () => {
    const draft = sanitizeDraft({ ...raw, why: '안 하면 과태료 50만원입니다.' }, source);
    expect(draft?.why).toBe('');
    expect(draft?.title).toBe('전입신고 하기');
  });

  it('질문에만 있는 숫자는 근거가 아니다', () => {
    const draft = sanitizeDraft({ ...raw, why: '30일 안에 해야 합니다.', dueOffsetDays: 30 }, source);
    expect(draft).toMatchObject({ why: '', dueOffsetDays: null });
  });

  it('문장 속 링크가 답변에 없으면 그 칸을 비운다', () => {
    expect(sanitizeDraft({ ...raw, howTo: 'www.example.com 에서 신청' }, source)?.howTo).toBe('');
  });

  it('답변에 글자 그대로 없는 링크 · 주소 · 전화는 버린다', () => {
    const draft = sanitizeDraft(
      { ...raw, linkUrl: 'https://example.com', placeAddress: '서울 노원구 월계로 1', placePhone: '02-000-0000' },
      source,
    );
    expect(draft).toMatchObject({ linkUrl: null, placeAddress: null, placePhone: null });
  });

  it('노출 조건은 질문자 상황 안에서만 남긴다', () => {
    const draft = sanitizeDraft({ ...raw, housingTypes: ['ONE_ROOM', 'DORM'], contractTypes: ['JEONSE'] }, source);
    expect(draft).toMatchObject({ housingTypes: ['ONE_ROOM'], contractTypes: [] });
    const anonymous = sanitizeDraft(raw, { ...source, askerHousingType: null, askerContractType: null });
    expect(anonymous).toMatchObject({ housingTypes: [], contractTypes: [] });
  });

  it('차 · 반려동물 · 학생 조건은 AI 가 켜지 못한다', () => {
    expect(sanitizeDraft({ ...raw, requiresCar: true, studentOnly: true }, source)).toMatchObject({
      requiresCar: false,
      studentOnly: false,
    });
  });

  it.each([null, [], 'text', { ...raw, category: 'ETC' }, { ...raw, category: undefined }])(
    '분류가 없거나 형식이 틀리면 null: %j',
    (value) => {
      expect(sanitizeDraft(value, source)).toBeNull();
    },
  );

  // 시연 질문(요청 문서): 답변에 기한 · 장소 · 링크가 없으면 AI 가 채워도 비워진다.
  it('시연 질문: 기숙사 고양이 — 답변에 없는 기한 · 장소 · 링크는 비운다', () => {
    const demo: DraftSource = {
      question: '기숙사에서 고양이 키워도 돼요?',
      answers: ['기숙사는 반려동물 금지예요. 걸리면 벌점 받아요.', '사감실에 먼저 물어보세요. 대부분 안 된다고 해요.'],
      askerHousingType: 'DORM',
      askerContractType: 'DORM_FEE',
    };
    const draft = sanitizeDraft({
      title: '기숙사 반려동물 규정 확인하기',
      why: '기숙사는 반려동물이 금지라 걸리면 벌점을 받습니다.',
      howTo: '들이기 전에 사감실에 먼저 물어봅니다.',
      category: 'HOUSING',
      dueOffsetDays: 7,
      linkUrl: 'https://dorm.example.ac.kr',
      placeName: '사감실',
      placeAddress: '서울 노원구 광운로 20',
      placePhone: '02-940-0000',
      housingTypes: ['DORM'],
      contractTypes: ['DORM_FEE'],
    }, demo);
    expect(draft).toEqual({
      title: '기숙사 반려동물 규정 확인하기',
      why: '기숙사는 반려동물이 금지라 걸리면 벌점을 받습니다.',
      howTo: '들이기 전에 사감실에 먼저 물어봅니다.',
      category: 'HOUSING',
      dueOffsetDays: null,
      linkUrl: null,
      placeName: '사감실',
      placeAddress: null,
      placePhone: null,
      housingTypes: ['DORM'],
      contractTypes: ['DORM_FEE'],
      requiresCar: false,
      requiresPet: false,
      studentOnly: false,
    });
  });
});
