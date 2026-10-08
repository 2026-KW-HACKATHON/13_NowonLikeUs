import type { Prisma } from '@prisma/client';

export type SeedTask = Omit<Prisma.TaskCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 확인된 항목만 넣는다. 확인되지 않은 값은 추정으로 채우지 않는다.
 * 새 항목을 추가할 때는 sourceNote에 출처와 확인 경로를, verifiedAt에 확인 날짜를 반드시 적는다.
 *
 * 2026-09-26·10-02 추가분은 docs/월계1동_생활정보.md(박용민 조사)의 "확인 완료" 항목만 옮겼다.
 * 오피스텔 전용 배출 규칙은 공식 자료로 확인되지 않아 넣지 않았다(건물마다 관리 방식이 다름).
 */

const CHECKED_0924 = new Date('2026-09-24T00:00:00Z');
const CHECKED_0926 = new Date('2026-09-26T00:00:00Z');
const CHECKED_1002 = new Date('2026-10-02T00:00:00Z');

/** 월계1동 주민센터 — 공식 홈페이지에서 확인 (2026-09-26) */
const CENTER = {
  placeName: '월계1동 주민센터',
  placeAddress: '서울특별시 노원구 석계로 59',
  placePhone: '02-2116-2414',
};

export const seedTasks: SeedTask[] = [
  // ───────── 행정 ─────────
  {
    title: '전입신고 하기',
    why:
      '이사한 날부터 14일 안에 하지 않으면 5만원 이하의 과태료가 부과될 수 있고, ' +
      '확정일자와 함께 해두지 않으면 보증금을 보호받지 못할 수 있습니다.',
    dueOffsetDays: 14,
    howTo:
      '새 주소지 관할 주민센터(월계1동 주민센터)를 직접 방문하거나 ' +
      '정부24에서 온라인으로 신고할 수 있습니다.',
    linkUrl: 'https://www.gov.kr/portal/onestopSvc/transferReport',
    ...CENTER,
    category: 'ADMIN',
    // 기숙사(DORM)는 거주증명서가 필요해서 아래 '빛솔재 거주증명서' 카드가 따로 안내한다.
    housingTypes: ['ONE_ROOM', 'OFFICETEL', 'VILLA', 'APARTMENT'],
    contractTypes: [],
    sourceNote:
      '정부24 「전입신고」 및 주민등록법 시행령 전입신고서 유의사항: 전입한 날부터 14일 이내 신고, ' +
      '정당한 사유 없이 미신고 시 5만원 이하 과태료. 주민센터 주소·전화는 월계1동 주민센터 공식 홈페이지',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '확정일자 받기',
    why:
      '임차보증금에 대한 우선변제권을 얻기 위해 필요합니다. ' +
      '받아두지 않으면 집이 경매에 넘어갈 때 보증금을 돌려받는 순위에서 밀립니다.',
    dueOffsetDays: 14,
    howTo:
      '전입신고를 하러 갈 때 임대차계약서 원본을 함께 가져가 확정일자를 받습니다. ' +
      '전입신고와 같은 창구에서 한 번에 처리됩니다.',
    linkUrl: null,
    ...CENTER,
    category: 'HOUSING',
    housingTypes: [],
    contractTypes: ['MONTHLY', 'JEONSE'],
    sourceNote: '찾기쉬운 생활법령정보 「주택임대차 — 이사 후의 체크리스트」 / 주민센터 정보는 월계1동 주민센터 공식 홈페이지',
    verifiedAt: CHECKED_0924,
  },
  {
    title: '전월세 신고하기 (해당하는 계약만)',
    // dueOffsetDays를 쓰지 않는 이유: 이 신고의 기한은 '계약일'로부터 30일인데
    // dueOffsetDays는 '이사일' 기준이다. 환산하면 틀린 날짜가 나오므로 비워두고 원문을 적는다.
    dueOffsetDays: null,
    why: '신고 의무 대상인데 하지 않으면 과태료가 부과될 수 있습니다.',
    howTo:
      '보증금 6천만 원을 초과하거나 월세가 30만 원을 초과하는 계약은 ' +
      '계약일로부터 30일 이내에 신고해야 합니다. 이 기준에 해당하지 않으면 신고 대상이 아닙니다. ' +
      '주민센터 방문 또는 부동산거래관리시스템에서 신고합니다.',
    linkUrl: null,
    ...CENTER,
    category: 'HOUSING',
    housingTypes: [],
    contractTypes: ['MONTHLY', 'JEONSE'],
    sourceNote: '주택 임대차 신고 기준(보증금 6천만 원 초과 또는 월세 30만 원 초과, 계약일부터 30일) — 조사 시 확인',
    verifiedAt: CHECKED_0924,
  },
  {
    title: '월세 세액공제 챙기기',
    // 연말정산 절차라 이사일 기준 기한이 없다.
    dueOffsetDays: null,
    why: '조건에 맞는데 신청하지 않으면 낸 월세의 일부를 돌려받을 기회를 놓칩니다.',
    howTo:
      '총급여 8,000만원 이하 무주택 세대주(또는 요건을 갖춘 세대원)라면, ' +
      '연말정산 때 주민등록표등본, 임대차계약서 사본, 월세 이체 내역을 회사에 제출합니다. ' +
      '계약서 주소와 주민등록 주소가 같아야 합니다.',
    linkUrl: null,
    category: 'ADMIN',
    housingTypes: [],
    contractTypes: ['MONTHLY'],
    sourceNote: '국세청 「월세액 세액공제」 공식 안내 (대상·대상주택·공제율·준비서류)',
    verifiedAt: CHECKED_0926,
  },

  // ───────── 쓰레기 (일반주택: 원룸·빌라) ─────────
  {
    title: '생활쓰레기 버리는 날·시간 알아두기',
    dueOffsetDays: null,
    why: '정해진 요일·시간·장소를 지키지 않으면 수거되지 않을 수 있습니다. 특히 토요일과 공휴일 전날에는 내놓으면 안 됩니다.',
    howTo:
      '일요일~금요일 18시~24시에 종량제봉투에 담아 내 집 앞에 내놓습니다. ' +
      '토요일과 공휴일 전날에는 내놓지 않습니다. 월계1동 수거업체는 한국진개입니다.',
    linkUrl: null,
    placeName: '한국진개 (월계1동 수거업체)',
    placeAddress: null,
    placePhone: '02-994-3440',
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'VILLA'],
    contractTypes: [],
    sourceNote:
      '노원구청 「생활폐기물배출안내 및 종량제배출방법」: 일반주택·상가지역은 일~금 18:00~24:00 ' +
      '내 집·내 점포 앞 배출, 수거업체 표의 "토요일과 공휴일 전일은 배출금지"를 적용 ' +
      '(같은 페이지 상단의 "공휴일 제외"보다 구체적인 기준), 월계1동·월계2동 수거업체 한국진개(02-994-3440)',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '재활용 버리는 요일 알아두기',
    dueOffsetDays: null,
    why: '품목마다 버리는 요일이 달라서, 모르고 내놓으면 수거되지 않습니다.',
    howTo:
      '투명페트병과 폐비닐은 목요일에만 내놓습니다. 종이·캔·플라스틱·병·스티로폼은 목요일과 토요일을 뺀 날 ' +
      '18시~24시에 내 집 앞에 내놓습니다. 투명·반투명 봉투에 품목별로 담고, 내용물을 비우고 라벨·테이프를 떼어 주세요.',
    linkUrl: null,
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'VILLA'],
    contractTypes: [],
    sourceNote:
      '노원구청 「재활용품 배출안내 및 배출방법」: 투명페트병·폐비닐은 목요일, ' +
      '그 외 재활용품은 목·토요일 제외, 배출시간 18:00~24:00',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '작은 가전 버리는 요일 알아두기',
    dueOffsetDays: null,
    why: '전자레인지·드라이기 같은 소형 가전은 동마다 수거 요일이 정해져 있습니다.',
    howTo:
      '5개 미만이면 스마트클린 노원이나 주민센터에 신청합니다. 월계동은 화요일에 수거하며, ' +
      '신청일로부터 7일 이후에 내놓아야 합니다.',
    linkUrl: 'https://smartclean.nowon.kr',
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'VILLA'],
    contractTypes: [],
    sourceNote: '노원구청 「대형생활폐기물 배출안내」: 일반주택 소형 폐가전 5개 미만 동별 수거요일, 월계동 화요일',
    verifiedAt: CHECKED_0926,
  },

  {
    title: '음식물쓰레기 버리는 방법 알아두기',
    dueOffsetDays: null,
    why: '전용 수거용기에 납부필증을 붙이지 않거나 금지된 날에 내놓으면 수거되지 않습니다.',
    howTo:
      '일요일~금요일 저녁 6시 이후, 3L·6L 음식물 전용 수거용기에 담아 내 집 앞에 내놓습니다. ' +
      '공휴일과 공휴일 전날에는 내놓지 않습니다. 버릴 때마다 납부필증(1L당 100원)을 용기 손잡이에 붙입니다. ' +
      '3L 용기는 전입 시 주민센터에서 받을 수 있습니다(재고가 없으면 지급되지 않을 수 있음). ' +
      '차가 들어오기 어려운 턱·경사 위라면 차가 닿는 아래쪽에 내놓습니다.',
    linkUrl: null,
    placeName: '한국진개 (월계1동 수거업체)',
    placeAddress: null,
    placePhone: '02-994-3440',
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'VILLA'],
    contractTypes: [],
    sourceNote:
      '2026-10-02 노원구청 자원순환과 전화 확인(주 6일 배출, 토요일 야간 배출 금지, 접근 곤란 구역 배출 위치) / ' +
      '노원구청 「생활폐기물배출안내 및 종량제배출방법」(토요일·공휴일 전일 배출금지) / ' +
      '노원구청 「음식물류폐기물 배출안내」(전용 수거용기, 저녁 6시 이후 문전배출, 납부필증 1L당 100원, 공휴일 미수거)',
    verifiedAt: CHECKED_1002,
  },
  {
    title: '종량제봉투 파는 곳 알아두기',
    dueOffsetDays: null,
    why: '생활쓰레기는 종량제봉투에 담아야만 가져갑니다. 봉투는 지정된 판매소에서만 살 수 있습니다.',
    howTo:
      '월계1동 근처 판매소: 이마트24 광운대역점(석계로 98-1, 02-6010-1032), ' +
      'GS25 월계성북역점(석계로 103, 02-913-6459), 농민마트(광운로 61, 02-941-7778), ' +
      '가락홈마트(광운로 46 대동아파트 상가동, 02-909-3111). 판매소는 바뀔 수 있으니 가기 전에 전화로 확인하세요.',
    linkUrl: 'https://news.seoul.go.kr/env/location-sales',
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'OFFICETEL', 'VILLA', 'APARTMENT'],
    contractTypes: [],
    sourceNote:
      '서울시 종량제물품 판매소 위치안내 → 노원구 공식 판매소 조회에서 판매 이력·전화번호 확인, ' +
      '주소는 별도 위치자료로 교차확인',
    verifiedAt: CHECKED_1002,
  },

  // ───────── 쓰레기 (아파트) ─────────
  {
    title: '우리 단지 분리배출 요일 확인하기',
    dueOffsetDays: null,
    why: '아파트는 단지마다 배출 요일과 수거함이 따로 정해져 있어서, 일반주택 규칙과 다릅니다.',
    howTo: '관리사무소나 단지 게시판에서 재활용 배출 요일과 수거함 위치를 확인합니다.',
    linkUrl: null,
    category: 'WASTE',
    housingTypes: ['APARTMENT'],
    contractTypes: [],
    sourceNote: '노원구청 「재활용품 배출안내 및 배출방법」: 공동주택은 단지별 지정요일에 지정 수거함에 배출',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '우리 단지 음식물쓰레기 방식 확인하기',
    dueOffsetDays: null,
    why: '아파트 음식물쓰레기는 단지마다 방식이 달라, 수수료가 관리비로 나가는 방식도 다릅니다.',
    howTo:
      '전용 수거용기 방식이면 관리비로 세대별 균등 부과되고, RFID 종량기 방식이면 버린 양만큼 부과됩니다. ' +
      '우리 단지가 어떤 방식인지, 어디에 버리는지 관리사무소에 확인합니다.',
    linkUrl: null,
    category: 'WASTE',
    housingTypes: ['APARTMENT'],
    contractTypes: [],
    sourceNote: '노원구청 「음식물류폐기물 배출안내」: 공동주택 120L 전용수거용기 방식·RFID 방식, 관리사무소가 세대별 부과',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '작은 가전은 관리사무소에 먼저 물어보기',
    dueOffsetDays: null,
    why: '자체 재활용 업체를 쓰는 단지는 구청 소형 폐가전 수거를 신청해도 가져가지 않을 수 있습니다.',
    howTo:
      '5개 미만이면 관리사무소에 문의한 뒤 단지 재활용 배출장소에 내놓습니다. ' +
      '5개 이상이면 폐가전 무상방문수거(1599-0903)를 이용할 수 있습니다.',
    linkUrl: null,
    placeName: '폐가전 무상방문수거',
    placeAddress: null,
    placePhone: '1599-0903',
    category: 'WASTE',
    housingTypes: ['APARTMENT'],
    contractTypes: [],
    sourceNote: '노원구청 「대형생활폐기물 배출안내」: 공동주택 소형 폐가전 5개 미만은 관리사무소 문의 후 단지 내 재활용장 배출',
    verifiedAt: CHECKED_0926,
  },

  // ───────── 쓰레기 (공통·기숙사) ─────────
  {
    title: '큰 가구 버리는 방법 알아두기 (대형폐기물)',
    dueOffsetDays: null,
    why: '침대·책상 같은 큰 물건은 신고하고 수수료를 내야 가져갑니다. 신고한 품목과 다르면 수거되지 않을 수 있습니다.',
    howTo:
      '스마트클린 노원에서 품목을 선택해 수수료를 결제하고, 배출증을 물건에 붙여 신고한 장소(내 집·건물 앞)에 내놓습니다. ' +
      '온라인이 어려우면 주민센터에서도 신청할 수 있습니다. 수수료는 품목·규격마다 다릅니다.',
    linkUrl: 'https://smartclean.nowon.kr',
    category: 'WASTE',
    housingTypes: ['ONE_ROOM', 'OFFICETEL', 'VILLA', 'APARTMENT'],
    contractTypes: [],
    sourceNote: '노원구청 「대형생활폐기물 배출안내」 및 스마트클린 노원: 온라인 신고 절차, 품목별 수수료 부과기준',
    verifiedAt: CHECKED_0926,
  },
  {
    title: '빛솔재 쓰레기 버리는 곳 알아두기',
    dueOffsetDays: null,
    why: '기숙사는 일반주택과 달리 정해진 분리수거장에 직접 버려야 합니다.',
    howTo: '광운대학교 행복기숙사 빛솔재는 A동 B3층 분리수거장에 직접 분리해서 버립니다.',
    linkUrl: null,
    placeName: '광운대학교 행복기숙사 빛솔재',
    placeAddress: '서울특별시 노원구 광운로 21',
    placePhone: '02-6958-9402',
    category: 'WASTE',
    housingTypes: ['DORM'],
    contractTypes: [],
    sourceNote: '광운대학교 행복기숙사 빛솔재 공식 FAQ: 쓰레기 배출 및 분리수거는 A동 B3층 분리수거장에 직접 배출',
    verifiedAt: CHECKED_0926,
  },

  {
    title: '빛솔재 거주증명서 받아서 전입신고하기',
    dueOffsetDays: 14,
    why:
      '기숙사에서 전입신고를 대신 해주지 않습니다. 이사한 날부터 14일 안에 직접 하지 않으면 ' +
      '5만원 이하의 과태료가 부과될 수 있습니다.',
    howTo:
      '빛솔재 홈페이지에서 거주증명서를 발급받아, 본인이 직접 주민센터 방문 또는 정부24로 전입신고합니다. ' +
      '궁금한 점은 빛솔재 행정실(B2 207호, 09:00~17:30)에 문의합니다.',
    linkUrl: 'https://kw.happydorm.or.kr/',
    placeName: '빛솔재 행정실',
    placeAddress: '서울특별시 노원구 광운로 21, B2 207호',
    placePhone: '02-6958-9402',
    category: 'ADMIN',
    housingTypes: ['DORM'],
    contractTypes: [],
    sourceNote:
      '2026-10-02 광운대학교 행복기숙사 빛솔재 행정실 전화 확인: 행정실이 전입신고를 일괄 처리하지 않으며, ' +
      '입사생이 홈페이지에서 거주증명서를 발급받아 직접 신고 / 광운대학교 행복기숙사 공식 홈페이지 / ' +
      '기한·과태료는 정부24 「전입신고」(전입한 날부터 14일 이내, 미신고 시 5만원 이하 과태료)',
    verifiedAt: CHECKED_1002,
  },

  // ───────── 생활 (차량) ─────────
  {
    title: '거주자 우선주차 신청하기',
    dueOffsetDays: null,
    why: '배정받지 않고 구획에 세우면 부정주차 요금이나 견인 조치를 받을 수 있습니다.',
    howTo:
      '노원구 거주자우선주차 홈페이지에서 회원가입 후 "주차구획신청"으로 이용기간·동·구획을 고릅니다. ' +
      '정기신청은 12월 1~10일(상반기), 6월 1~10일(하반기)이고, 남은 구획은 수시로 신청할 수 있습니다. ' +
      '증빙서류를 내지 않으면 배정점수가 0점 처리될 수 있습니다.',
    linkUrl: null,
    placeName: '노원구시설관리공단 주차사업팀',
    placeAddress: '서울특별시 노원구 상계로1길 34, 2층',
    placePhone: '02-2289-6732',
    category: 'LIFE',
    housingTypes: [],
    contractTypes: [],
    requiresCar: true,
    sourceNote:
      '노원구시설관리공단 「거주자우선주차장 신청/배정안내」: 온라인·방문 신청 절차, 정기신청 기간. ' +
      '전화번호는 공단 「조직 및 부서안내」의 거주자우선주차 안내 번호(02-2289-6732)로 교차확인 ' +
      '(안내 페이지의 02-2289-6727은 현재 조직표상 거주자보험 담당)',
    verifiedAt: CHECKED_1002,
  },

  // ───────── 생활 (반려동물) ─────────
  {
    title: '반려견 동물등록하기',
    // 기한이 '소유권을 얻은 날·월령 2개월이 된 날부터 30일'이라 이사일로 환산할 수 없다.
    dueOffsetDays: null,
    why: '등록하지 않으면 과태료가 부과됩니다(1차 20만원, 2차 40만원, 3차 이상 60만원).',
    howTo:
      '월령 2개월 이상인 개는 기르기 시작한 날(또는 2개월이 된 날)부터 30일 안에 등록해야 합니다. ' +
      '월계동 등록 대행기관: 아란종합동물병원(02-905-7588), 우솔동물병원(02-973-7588), ' +
      '웰니스 동물병원(월계이마트, 02-949-0975), 유림동물병원(02-900-7710).',
    linkUrl: 'https://www.animal.go.kr/front/awtis/record/recordAgencyList.do?menuNo=2000000002',
    category: 'LIFE',
    housingTypes: [],
    contractTypes: [],
    requiresPet: true,
    sourceNote:
      '국가동물보호정보시스템 「동물등록 대행기관 조회」(노원구 월계동 4곳) / ' +
      '국가법령정보센터 「동물보호법」·시행령(등록대상·기한) / 농림축산식품부 「반려동물 펫티켓」(2026-03-13, 과태료)',
    verifiedAt: CHECKED_1002,
  },
];