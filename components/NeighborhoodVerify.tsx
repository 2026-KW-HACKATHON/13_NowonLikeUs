'use client';

import { useState } from 'react';
import { readApiError } from '@/lib/authView';
import { checkPosition } from '@/lib/neighborhood';
import { geoErrorOutcome, neighborhoodMessage, type NeighborhoodOutcome } from '@/lib/neighborhoodView';
import { loadSession, setNeighborhoodVerified, useSession } from '@/lib/useSession';

type Busy = null | 'locating' | 'saving' | 'removing';

/** 휴대폰 위치 한 번. 오래된 위치를 다시 쓰지 않고(maximumAge 0) 15초까지 기다린다. */
function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }),
  );
}

/**
 * 노원 동네 인증 (선택). 답변 쓰기 칸 아래에 붙는다. 로그인한 사람에게만 보인다.
 *
 * 위치는 이 브라우저 안에서만 판정한다(checkPosition). 서버에는 "인증했다"만 보내고 좌표는 보내지 않는다.
 * 인증하지 않아도 답변 · 맞아요는 그대로 된다 — 배지만 달라진다.
 * `onChange` 는 인증 상태가 바뀐 직후 불린다. 목록이 떠 있는 내 답변의 배지를 바로 맞춘다.
 */
export default function NeighborhoodVerify({ onChange }: { onChange: (verified: boolean) => void }) {
  const session = useSession();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session.user) return null;

  function finish(outcome: NeighborhoodOutcome) {
    setBusy(null);
    setMessage(neighborhoodMessage(outcome));
  }

  async function verify() {
    setMessage(null);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !window.isSecureContext) {
      finish('unavailable');
      return;
    }

    setBusy('locating');
    let position: GeolocationPosition;
    try {
      position = await locate();
    } catch (e) {
      finish(geoErrorOutcome(typeof e === 'object' && e !== null && 'code' in e ? Number(e.code) : 0));
      return;
    }

    // 브라우저 coords 는 위도 · 경도가 따로 온다. 판정 함수는 [경도, 위도] 순서다.
    const check = checkPosition({
      lng: position.coords.longitude,
      lat: position.coords.latitude,
      accuracy: position.coords.accuracy,
    });
    if (check !== 'inside') {
      finish(check);
      return;
    }

    setBusy('saving');
    try {
      // 본문은 빈 객체다. 좌표는 싣지 않는다.
      const res = await fetch('/api/me/neighborhood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.status === 401) await loadSession(true);
      if (!res.ok) {
        setBusy(null);
        setMessage({ ok: false, text: await readApiError(res, neighborhoodMessage('failed').text) });
        return;
      }
      setNeighborhoodVerified(true);
      onChange(true);
      finish('inside');
    } catch {
      finish('failed');
    }
  }

  async function remove() {
    setMessage(null);
    setBusy('removing');
    try {
      const res = await fetch('/api/me/neighborhood', { method: 'DELETE' });
      if (res.status === 401) await loadSession(true);
      if (!res.ok) {
        setBusy(null);
        setMessage({ ok: false, text: await readApiError(res, '인증을 지우지 못했습니다. 잠시 후 다시 눌러 주세요.') });
        return;
      }
      setNeighborhoodVerified(false);
      onChange(false);
      setBusy(null);
      setMessage({ ok: true, text: '노원 인증을 지웠습니다. 내 답변의 배지도 사라집니다.' });
    } catch {
      setBusy(null);
      setMessage({ ok: false, text: '연결이 끊겼습니다. 잠시 후 다시 눌러 주세요.' });
    }
  }

  const status = message && (
    <p className={message.ok ? 'nverify__msg nverify__msg--ok' : 'nverify__msg'} role="status">
      {message.text}
    </p>
  );

  if (session.neighborhoodVerified) {
    return (
      <div className="nverify nverify--done">
        <p className="nverify__state">
          <span className="nbadge">노원 인증</span> 내 답변 옆에 붙어 있습니다.
        </p>
        <button type="button" className="mod-button" onClick={remove} disabled={busy !== null}>
          {busy === 'removing' ? '지우는 중…' : '인증 지우기'}
        </button>
        {status}
      </div>
    );
  }

  return (
    <div className="nverify">
      <button type="button" className="secondary-button" onClick={verify} disabled={busy !== null}>
        {busy === 'locating' ? '위치 확인 중…' : busy === 'saving' ? '저장 중…' : '노원 동네 인증하기 (선택)'}
      </button>
      <p className="nverify__note">
        노원구 안에서 누르면 내 답변 옆에 &ldquo;노원 인증&rdquo;이 붙습니다. 위치는 이 휴대폰 안에서만 확인하고 서버로 보내지 않습니다.
        인증한 날짜만 남고, 180일이 지나면 사라집니다.
      </p>
      {status}
    </div>
  );
}
