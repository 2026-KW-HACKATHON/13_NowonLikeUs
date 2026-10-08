'use client';

import Image from 'next/image';
import Link from 'next/link';
import Masthead from '@/components/Masthead';
import { CATEGORY_LABEL } from '@/lib/labels';
import { useProfile } from '@/lib/useProfile';
import type { TaskCategory } from '@/lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];

/**
 * 표지. 누구든 `/` 로 오면 여기서 시작한다 — 전시 · QR 로 처음 들어온 사람에게 무슨 서비스인지 먼저 말한다.
 *
 * 상황을 이미 입력한 사람에게는 같은 자리의 버튼이 "내 할 일 보기"가 된다. 입력 여부는 브라우저
 * 저장값이라, 읽기 전에는 처음 온 사람 기준으로 보여 준다(버튼 자리 · 크기는 같아서 흔들리지 않는다).
 */
export default function Home() {
  const { hydrated, profile } = useProfile();
  const returning = hydrated && profile !== null;

  return (
    <main>
      <Masthead profile={profile} />

      <section className="cover" aria-labelledby="cover-title">
        {/* 제목 오른쪽에 로고. 로고 원본(public/logo.svg)은 글자까지 도형이라 기기마다 글꼴이 달라지지 않는다. */}
        <div className="cover__head">
          <div className="cover__heading">
            <p className="cover__eyebrow">광운대 앞 · 노원구 월계1동</p>
            <h1 id="cover-title" className="cover__title">
              월계1동에
              <br />
              처음 왔나요?
            </h1>
          </div>
          <Image
            src="/logo.svg"
            alt="월계는 처음이라"
            width={551}
            height={756}
            className="cover__logo"
            priority
            unoptimized
          />
        </div>
        <p className="cover__lead">
          집 형태와 계약 형태만 알려 주세요. 나에게 해당하는 할 일만 기한과 함께 알려 드립니다.
        </p>

        {/* 어떤 일을 알려 주는지 — 색만으로 구분하지 않게 글자를 같이 붙인다. 장식이 아니라 목차다. */}
        <ul className="cover__cats" aria-label="알려 드리는 일">
          {CATEGORIES.map((c) => (
            <li key={c} className="cover__cat" data-category={c}>
              {CATEGORY_LABEL[c]}
            </li>
          ))}
        </ul>

        <Link href={returning ? '/tasks' : '/setup'} className="button-link cover__start">
          {returning ? '내 할 일 보기' : '내 할 일 받기'}
        </Link>
        <p className="cover__note">회원가입 없이 바로 시작합니다. 상세 주소는 받지 않습니다.</p>
      </section>

      <section className="cover-give" aria-labelledby="cover-give-title">
        <h2 id="cover-give-title" className="cover-give__title">
          먼저 와 본 사람이라면
        </h2>
        <p className="cover-give__body">
          막혔던 걸 물어본 이웃이 있어요. 겪어 본 대로 답해 주면, 확인을 거쳐 다음 사람의 할 일이 됩니다.
        </p>
        <Link href="/questions" className="button-link button-link--secondary">
          이웃의 질문에 답하기
        </Link>
      </section>
    </main>
  );
}
