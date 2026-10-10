import { describe, expect, it } from 'vitest';
import {
  NEIGHBORHOOD_MAX_ACCURACY_M,
  NEIGHBORHOOD_VALID_DAYS,
  checkPosition,
  isInNowon,
  isNeighborhoodVerified,
} from '@/lib/neighborhood';
import { NOWON_BOUNDARY } from '@/lib/nowonBoundary';

/* 기준점은 지도 기준 근사 좌표 — 경계에서 충분히 떨어진 곳만 쓴다. [경도, 위도] */
const INSIDE: [string, number, number][] = [
  ['광운대 정문 부근', 127.0586, 37.6196],
  ['노원역 부근', 127.0617, 37.6558],
  ['수락산역 부근', 127.0558, 37.6779],
  ['태릉입구역 부근', 127.075, 37.6176],
];

const OUTSIDE: [string, number, number][] = [
  ['도봉구청 부근', 127.0471, 37.6688],
  ['석관동 한예종 부근 (성북구)', 127.0563, 37.6055],
  ['서울시청', 126.978, 37.5665],
];

const DAY_MS = 24 * 60 * 60 * 1000;

describe('isInNowon', () => {
  it.each(INSIDE)('%s 는 안', (_name, lng, lat) => {
    expect(isInNowon(lng, lat)).toBe(true);
  });

  it.each(OUTSIDE)('%s 는 밖', (_name, lng, lat) => {
    expect(isInNowon(lng, lat)).toBe(false);
  });

  it('꼭짓점 위는 안 (301개 전부)', () => {
    for (const [lng, lat] of NOWON_BOUNDARY) expect(isInNowon(lng, lat)).toBe(true);
  });

  // 닫는 점이 없으니 마지막 점 → 첫 점 변까지 포함해 모든 변의 가운데를 본다.
  it('변 위는 안 (마지막 점에서 첫 점으로 돌아오는 변 포함, 모든 변의 가운데)', () => {
    NOWON_BOUNDARY.forEach(([lng, lat], i) => {
      const [nextLng, nextLat] = NOWON_BOUNDARY[(i + 1) % NOWON_BOUNDARY.length];
      expect(isInNowon((lng + nextLng) / 2, (lat + nextLat) / 2)).toBe(true);
    });
  });

  // 브라우저 coords 는 latitude · longitude 가 따로 온다. 바꿔 넣으면 한반도 밖 좌표가 된다.
  it.each(INSIDE)('%s 도 경도 · 위도 순서를 바꿔 넣으면 밖', (_name, lng, lat) => {
    expect(isInNowon(lat, lng)).toBe(false);
  });

  it('숫자가 아니면 밖', () => {
    expect(isInNowon(Number.NaN, 37.6196)).toBe(false);
    expect(isInNowon(127.0586, Number.NaN)).toBe(false);
    expect(isInNowon(Number.POSITIVE_INFINITY, 37.6196)).toBe(false);
  });
});

describe('checkPosition', () => {
  const kwangwoon = { lng: 127.0586, lat: 37.6196 };
  const cityHall = { lng: 126.978, lat: 37.5665 };

  it('기준값은 200m', () => {
    expect(NEIGHBORHOOD_MAX_ACCURACY_M).toBe(200);
  });

  it('오차 200m 는 판정한다', () => {
    expect(checkPosition({ ...kwangwoon, accuracy: 200 })).toBe('inside');
    expect(checkPosition({ ...cityHall, accuracy: 200 })).toBe('outside');
  });

  it('오차 201m 는 안 · 밖을 따지지 않고 inaccurate', () => {
    expect(checkPosition({ ...kwangwoon, accuracy: 201 })).toBe('inaccurate');
    expect(checkPosition({ ...cityHall, accuracy: 201 })).toBe('inaccurate');
  });

  it('오차가 작으면 안은 inside, 밖은 outside', () => {
    expect(checkPosition({ ...kwangwoon, accuracy: 15 })).toBe('inside');
    expect(checkPosition({ ...cityHall, accuracy: 15 })).toBe('outside');
    expect(checkPosition({ ...kwangwoon, accuracy: 0 })).toBe('inside');
  });

  it('오차 값이 이상하면 inaccurate', () => {
    expect(checkPosition({ ...kwangwoon, accuracy: Number.NaN })).toBe('inaccurate');
    expect(checkPosition({ ...kwangwoon, accuracy: -1 })).toBe('inaccurate');
    expect(checkPosition({ ...kwangwoon, accuracy: Number.POSITIVE_INFINITY })).toBe('inaccurate');
  });

  it('경도 · 위도를 바꿔 넣으면 outside', () => {
    expect(checkPosition({ lng: kwangwoon.lat, lat: kwangwoon.lng, accuracy: 15 })).toBe('outside');
  });
});

describe('isNeighborhoodVerified', () => {
  const verifiedAt = new Date('2026-10-10T03:00:00Z');
  const after = (ms: number) => new Date(verifiedAt.getTime() + ms);

  it('기준값은 180일', () => {
    expect(NEIGHBORHOOD_VALID_DAYS).toBe(180);
  });

  it('인증한 적 없으면 false', () => {
    expect(isNeighborhoodVerified(null, verifiedAt)).toBe(false);
  });

  it('막 인증했으면 true', () => {
    expect(isNeighborhoodVerified(verifiedAt, verifiedAt)).toBe(true);
  });

  it('179일째는 true', () => {
    expect(isNeighborhoodVerified(verifiedAt, after(179 * DAY_MS))).toBe(true);
  });

  it('180일이 되기 1ms 전까지 true, 정확히 180일이 되면 false', () => {
    expect(isNeighborhoodVerified(verifiedAt, after(180 * DAY_MS - 1))).toBe(true);
    expect(isNeighborhoodVerified(verifiedAt, after(180 * DAY_MS))).toBe(false);
  });

  it('181일째는 false', () => {
    expect(isNeighborhoodVerified(verifiedAt, after(181 * DAY_MS))).toBe(false);
  });

  it('서버 사이 시계 차이로 인증 시각이 조금 뒤여도 true', () => {
    expect(isNeighborhoodVerified(verifiedAt, after(-500))).toBe(true);
  });

  it('잘못된 날짜면 false', () => {
    expect(isNeighborhoodVerified(new Date('invalid'), verifiedAt)).toBe(false);
    expect(isNeighborhoodVerified(verifiedAt, new Date('invalid'))).toBe(false);
  });
});
