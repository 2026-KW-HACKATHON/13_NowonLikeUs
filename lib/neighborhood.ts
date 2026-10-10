import { NOWON_BOUNDARY } from './nowonBoundary';

/*
 * 노원 동네 인증 판정. 순수 로직만 둔다(서버 코드 import 금지) — 화면이 브라우저 안에서 그대로 부른다.
 *
 * 위치는 휴대폰 안에서만 판정한다. 브라우저가 받은 좌표로 여기서 노원구 안인지 계산하고,
 * 서버(POST /api/me/neighborhood)에는 "인증했다"만 보낸다. 좌표는 서버로 보내지도, 저장하지도 않는다.
 * 그래서 개발자 도구로 속일 수는 있다. 배지는 참고용 신뢰 표시이고, 오정보를 막는 관문은 여전히
 * 운영자의 출처 확인이다(알고 고른 한계).
 */

/** 인증 유효 기간 (일). 인증한 순간부터 정확히 180일이 되면 배지가 사라진다. */
export const NEIGHBORHOOD_VALID_DAYS = 180;
/** GPS 오차가 이보다 크면 판정하지 않는다 (미터). 경계 근처에서 오차가 크면 밖인데 안으로 나올 수 있다. */
export const NEIGHBORHOOD_MAX_ACCURACY_M = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 점이 변 위에 있다고 볼 허용 오차 (외적 값, 도² 단위).
 * 변 위의 점도 소수 계산에서 외적이 0 이 아니라 1e-17 안팎으로 나온다. 1e-12 는 길이 0.01도(약 1km)인 변에서
 * 1e-10도(약 0.01mm) 거리에 해당해, GPS 오차에 비하면 사실상 0 이다.
 */
const ON_EDGE_EPSILON = 1e-12;

type Point = readonly [number, number];

/** 경계를 감싸는 사각형. 대부분의 바깥 점(경도 · 위도를 바꿔 넣은 값 포함)을 여기서 바로 거른다. */
const BOUNDS = NOWON_BOUNDARY.reduce(
  (box, [lng, lat]) => ({
    minLng: Math.min(box.minLng, lng),
    maxLng: Math.max(box.maxLng, lng),
    minLat: Math.min(box.minLat, lat),
    maxLat: Math.max(box.maxLat, lat),
  }),
  { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity },
);

/** (x, y) 가 선분 a–b 위에 있는가. 끝점(꼭짓점)도 포함한다. */
function isOnSegment(x: number, y: number, [ax, ay]: Point, [bx, by]: Point): boolean {
  const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  if (Math.abs(cross) > ON_EDGE_EPSILON) return false;
  return (
    x >= Math.min(ax, bx) - ON_EDGE_EPSILON &&
    x <= Math.max(ax, bx) + ON_EDGE_EPSILON &&
    y >= Math.min(ay, by) - ON_EDGE_EPSILON &&
    y <= Math.max(ay, by) + ON_EDGE_EPSILON
  );
}

/**
 * 점이 다각형 안인가 (광선 교차). 점에서 동쪽으로 반직선을 그어 변과 몇 번 만나는지 센다 — 홀수면 안.
 * 다각형은 닫는 점이 없는 꼭짓점 목록이다(마지막 점이 첫 점과 이어진다). 변 위의 점은 안으로 본다.
 */
function isInPolygon(x: number, y: number, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (isOnSegment(x, y, a, b)) return true;
    // 변이 점의 위도를 가로지를 때만 센다. 한쪽 끝만 포함(>)해서 꼭짓점을 두 번 세지 않는다.
    if (a[1] > y !== b[1] > y) {
      const crossLng = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x < crossLng) inside = !inside;
    }
  }
  return inside;
}

/**
 * 점이 노원구 경계 안인가. 경계 위(선 위)는 안으로 본다.
 * 인자 순서는 경계 데이터와 같은 [경도, 위도]다. 브라우저 `coords` 는 `latitude` · `longitude` 가 따로 오니 바꿔 넣지 않게 주의.
 */
export function isInNowon(lng: number, lat: number): boolean {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng || lat < BOUNDS.minLat || lat > BOUNDS.maxLat) return false;
  return isInPolygon(lng, lat, NOWON_BOUNDARY);
}

/** 브라우저 위치 한 번. `accuracy` 는 `coords.accuracy` 그대로(미터). */
export interface NeighborhoodPosition {
  lng: number;
  lat: number;
  accuracy: number;
}

/** 판정 결과. 화면이 이 값으로 안내 문구를 고른다. */
export type PositionCheck = 'inside' | 'outside' | 'inaccurate';

/**
 * 브라우저 위치 → 판정. 오차가 200m 를 넘으면(또는 오차 값이 이상하면) 안 · 밖을 따지지 않고 'inaccurate'.
 * 'inside' 일 때만 화면이 POST /api/me/neighborhood 를 부른다.
 */
export function checkPosition(pos: NeighborhoodPosition): PositionCheck {
  if (!Number.isFinite(pos.accuracy) || pos.accuracy < 0 || pos.accuracy > NEIGHBORHOOD_MAX_ACCURACY_M) {
    return 'inaccurate';
  }
  return isInNowon(pos.lng, pos.lat) ? 'inside' : 'outside';
}

/**
 * 배지를 보여 줄지. 인증 안 했거나 180일이 지났으면 false.
 * 인증 시각이 `now` 보다 조금 뒤여도(서버 사이 시계 차이) 막 인증한 것으로 보고 true 다.
 */
export function isNeighborhoodVerified(verifiedAt: Date | null, now: Date): boolean {
  if (!verifiedAt) return false;
  const elapsed = now.getTime() - verifiedAt.getTime();
  if (Number.isNaN(elapsed)) return false;
  return elapsed < NEIGHBORHOOD_VALID_DAYS * DAY_MS;
}
