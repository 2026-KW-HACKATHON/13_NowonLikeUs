import { describe, it, expect } from 'vitest';
import { CONTRACT_LABEL, HOUSING_LABEL } from '@/lib/labels';
import { audienceSummary, emptyForm, formFromDraft, toPromoteRequest, toggle, type PromoteForm } from '@/lib/promotionForm';
import type { TaskDraft } from '@/lib/types';

const filled: PromoteForm = {
  ...emptyForm(),
  title: '음식물쓰레기 용기 받기',
  why: '전용 용기에 담아야 수거됩니다.',
  howTo: '주민센터에서 3L 용기를 받습니다.',
  category: 'WASTE',
  housingTypes: ['ONE_ROOM'],
  sourceNote: '주민 답변 + 노원구청 자원순환과 전화 확인 (10/7)',
};

const draft: TaskDraft = {
  title: '초안 제목', why: '초안 이유', howTo: '초안 방법', category: 'ADMIN', dueOffsetDays: 14,
  linkUrl: 'https://www.gov.kr', placeName: null, placeAddress: null, placePhone: '02-000-0000',
  housingTypes: ['DORM'], contractTypes: ['DORM_FEE'], requiresCar: false, requiresPet: true, studentOnly: true,
};

describe('formFromDraft', () => {
  it('초안 값을 양식에 옮긴다 (숫자는 글자로, null 은 빈칸으로)', () => {
    const form = formFromDraft(draft);
    expect(form).toMatchObject({ title: '초안 제목', category: 'ADMIN', dueOffsetDays: '14', linkUrl: 'https://www.gov.kr', placeName: '', placePhone: '02-000-0000', housingTypes: ['DORM'], requiresPet: true, studentOnly: true });
  });

  it('기한 없는 초안은 기한 칸이 빈칸', () => {
    expect(formFromDraft({ ...draft, dueOffsetDays: null }).dueOffsetDays).toBe('');
  });

  // 출처는 "운영자가 무엇으로 확인했는가"다. AI 가 채우면 확인 없이 발행될 수 있다.
  it('출처는 초안이 있어도 비워 둔다', () => {
    expect(formFromDraft(draft).sourceNote).toBe('');
  });

  it('초안 배열을 그대로 공유하지 않는다 (양식을 고쳐도 초안이 안 바뀜)', () => {
    const form = formFromDraft(draft);
    form.housingTypes.push('VILLA');
    expect(draft.housingTypes).toEqual(['DORM']);
  });
});

describe('toPromoteRequest', () => {
  it('정상 양식은 요청으로 바뀐다 (빈 칸은 null, 기한 없음은 null)', () => {
    const result = toPromoteRequest(filled, 'q1');
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      questionId: 'q1',
      sourceNote: '주민 답변 + 노원구청 자원순환과 전화 확인 (10/7)',
      task: { category: 'WASTE', dueOffsetDays: null, linkUrl: null, placeName: null, housingTypes: ['ONE_ROOM'] },
    });
  });

  it('기한 숫자는 숫자로', () => {
    const result = toPromoteRequest({ ...filled, dueOffsetDays: ' 14 ' }, 'q1');
    expect(result.ok && result.value.task.dueOffsetDays).toBe(14);
  });

  // parseInt('14일') 은 14 다. 운영자가 쓴 뜻을 화면이 추측하지 않는다.
  it.each(['14일', '2주', '1.5', '-1', '십사'])('기한에 숫자 말고 다른 게 섞이면 거절: %j', (due) => {
    expect(toPromoteRequest({ ...filled, dueOffsetDays: due }, 'q1').ok).toBe(false);
  });

  it('기한 상한은 서버 규칙 그대로 (366 거절)', () => {
    expect(toPromoteRequest({ ...filled, dueOffsetDays: '365' }, 'q1').ok).toBe(true);
    expect(toPromoteRequest({ ...filled, dueOffsetDays: '366' }, 'q1').ok).toBe(false);
  });

  it('분류를 안 고르면 거절하고 이유를 준다', () => {
    const result = toPromoteRequest({ ...filled, category: '' }, 'q1');
    expect(!result.ok && result.error).toBe('분류를 골라 주세요.');
  });

  it.each(['title', 'why', 'howTo', 'sourceNote'] as const)('%s 가 비면 거절', (field) => {
    expect(toPromoteRequest({ ...filled, [field]: '  ' }, 'q1').ok).toBe(false);
  });

  it('링크는 http · https 만 (서버 규칙 그대로)', () => {
    expect(toPromoteRequest({ ...filled, linkUrl: 'javascript:alert(1)' }, 'q1').ok).toBe(false);
    expect(toPromoteRequest({ ...filled, linkUrl: 'https://www.nowon.kr' }, 'q1').ok).toBe(true);
  });
});

describe('toggle', () => {
  it('켜면 넣고 끄면 뺀다, 두 번 넣지 않는다', () => {
    expect(toggle(['A'], 'B', true)).toEqual(['A', 'B']);
    expect(toggle(['A', 'B'], 'A', false)).toEqual(['B']);
    expect(toggle(['A'], 'A', true)).toEqual(['A']);
  });
});

describe('audienceSummary', () => {
  const labels = { housing: HOUSING_LABEL, contract: CONTRACT_LABEL };

  // 조건을 하나도 안 걸면 모든 사람 목록에 뜬다. 의도인지 다시 보게 따로 적는다.
  it('조건이 없으면 모든 사람', () => {
    expect(audienceSummary(emptyForm(), labels)).toBe('모든 사람');
  });

  it('걸린 조건을 글자로 나열한다', () => {
    expect(audienceSummary({ ...emptyForm(), housingTypes: ['ONE_ROOM', 'VILLA'], contractTypes: ['MONTHLY'], requiresPet: true }, labels))
      .toBe('원룸 · 빌라, 월세, 반려동물 있음');
  });
});
