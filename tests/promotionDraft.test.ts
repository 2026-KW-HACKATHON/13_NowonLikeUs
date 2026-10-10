import { describe, expect, it } from 'vitest';
import { numbersFromSource, sanitizeDraft, type DraftSource } from '@/lib/promotionDraft';

const source: DraftSource = {
  question: '전입신고는 언제까지 해야 하나요?',
  answers: ['이사하고 14일 안에 월계1동 주민센터(02-2116-0000)에서 하면 돼요. https://www.gov.kr 에서도 됩니다.'],
  askerHousingType: 'ONE_ROOM',
  askerContractType: 'MONTHLY',
};

const raw = {
  title: '전입신고 하기',
  why: '14일이 지나면 과태료가 나올 수 있습니다.',
  howTo: '주민센터 방문 또는 온라인 신청',
  category: 'ADMIN',
  dueOffsetDays: 14,
  linkUrl: 'https://www.gov.kr',
  placeName: '월계1동 주민센터',
  placeAddress: null,
  placePhone: '02-2116-0000',
  housingTypes: ['ONE_ROOM', 'CASTLE'],
  contractTypes: ['MONTHLY'],
};

describe('numbersFromSource', () => {
  it('원문에 있는 숫자만 쓰면 true', () => {
    expect(numbersFromSource('14일 안에', '이사하고 14일')).toBe(true);
  });
  it('원문에 없는 숫자가 있으면 false', () => {
    expect(numbersFromSource('과태료 50만원', '이사하고 14일')).toBe(false);
  });
});

describe('sanitizeDraft', () => {
  it('원문과 맞는 초안은 그대로 채운다', () => {
    expect(sanitizeDraft(raw, source)).toEqual({
      ...raw,
      housingTypes: ['ONE_ROOM'],
      requiresCar: false,
      requiresPet: false,
      studentOnly: false,
    });
  });

  it('원문에 없는 숫자가 섞인 문장은 비운다', () => {
    const draft = sanitizeDraft({ ...raw, why: '안 하면 과태료 50만원입니다.' }, source);
    expect(draft?.why).toBe('');
    expect(draft?.title).toBe('전입신고 하기');
  });

  it('원문에 없는 기한은 null 로 둔다', () => {
    expect(sanitizeDraft({ ...raw, dueOffsetDays: 30 }, source)?.dueOffsetDays).toBeNull();
  });

  it('원문에 글자 그대로 없는 링크 · 주소 · 전화는 버린다', () => {
    const draft = sanitizeDraft(
      { ...raw, linkUrl: 'https://example.com', placeAddress: '서울 노원구 월계로 1', placePhone: '02-000-0000' },
      source,
    );
    expect(draft).toMatchObject({ linkUrl: null, placeAddress: null, placePhone: null });
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
});
