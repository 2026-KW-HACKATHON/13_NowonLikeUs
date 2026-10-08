# 조사 대기 항목 (D 담당)

확인되면 `prisma/seed-data.ts`의 `seedTasks` 배열에 아래 양식으로 추가한다.
**확인하지 못한 값은 추정으로 채우지 않는다.** 항목 전체를 비워두는 것이 틀린 값을 넣는 것보다 낫다.

## 양식

```ts
{
  title: '',           // 뭘 해야 하나
  why: '',             // 안 하면 어떻게 되나 (이게 없으면 사람은 안 한다)
  dueOffsetDays: null, // 이사일 기준 며칠. 이사일 기준이 아니면 null로 두고 howTo에 원문을 적는다
  howTo: '',           // 절차
  linkUrl: null,
  placeName: null,     // 예: '월계1동 주민센터'
  placeAddress: null,
  placePhone: null,    // 전화 걸기 버튼에 쓰인다
  category: 'ADMIN',   // ADMIN | WASTE | HOUSING | LIFE
  housingTypes: [],    // 비우면 전원. 예: ['ONE_ROOM', 'VILLA']
  contractTypes: [],   // 비우면 전원
  requiresCar: false,
  requiresPet: false,
  studentOnly: false,
  sourceNote: '',      // 필수 — 어디서 어떻게 확인했는지
  verifiedAt: new Date('YYYY-MM-DDT00:00:00Z'), // 필수 — 확인한 날짜
}
```

## 확인해야 하는 것

- [ ] 월계1동 쓰레기 배출 요일 — **구역별로 갈리는지 먼저 확인.** 동 전체가 같다면 `/setup`의 구역 선택을 없앤다
- [ ] 음식물 쓰레기 배출 방법과 요일
- [ ] 종량제 봉투 판매처 (월계1동 실제 위치)
- [ ] 재활용 분리배출 요일·방법
- [ ] 대형폐기물 신고 절차와 수수료 (노원구 기준)
- [ ] 월계1동 주민센터 주소·전화번호
- [ ] 전입신고 과태료 금액
- [ ] 동물등록 절차·접수처·미등록 과태료 (`requiresPet: true`)
- [ ] 거주자 우선주차 신청 절차 (`requiresCar: true`)
- [ ] 광운대 기숙사 거주자의 전입신고 처리 방식 (`housingTypes: ['DORM']`)
- [ ] 아파트 관리사무소가 대행하는 항목 (`housingTypes: ['APARTMENT']`)
- [ ] 월세 세액공제 신청 방법 (`contractTypes: ['MONTHLY']`)