'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import Masthead from '@/components/Masthead';
import { CATEGORY_LABEL, CONTRACT_LABEL, HOUSING_LABEL } from '@/lib/labels';
import { timeAgo } from '@/lib/questionBoard';
import { useProfile } from '@/lib/useProfile';
import type { QuestionItem, QuestionListResponse, TaskCategory } from '@/lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];

/** 표지 오른쪽에 미리 보여 줄 답을 기다리는 질문 수. */
const PREVIEW_COUNT = 3;

/**
 * 표지. 누구든 `/` 로 오면 여기서 시작한다 — 전시 · QR 로 처음 들어온 사람에게 무슨 서비스인지 먼저 말한다.
 *
 * 상황을 이미 입력한 사람에게는 같은 자리의 버튼이 "내 할 일 보기"가 된다. 입력 여부는 브라우저
 * 저장값이라, 읽기 전에는 처음 온 사람 기준으로 보여 준다(버튼 자리 · 크기는 같아서 흔들리지 않는다).
 *
 * 아래 "이웃의 질문" 미리보기는 실제로 답을 기다리는 질문이다. 지어낸 예시를 넣지 않는다 —
 * 불러오지 못했거나 하나도 없으면 목록 자리를 통째로 비운다. 질문자 닉네임은 질문 화면과 같이 내보내지 않는다.
 */
export default function Home() {
  const { hydrated, profile } = useProfile();
  const returning = hydrated && profile !== null;
  const [preview, setPreview] = useState<{ questions: QuestionItem[]; now: Date } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/questions?status=OPEN', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<QuestionListResponse>) : null))
      .then((body) => {
        if (body) setPreview({ questions: body.questions.slice(0, PREVIEW_COUNT), now: new Date() });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const hasPreview = preview !== null && preview.questions.length > 0;

  return (
    <main className="main--cover">
      <Masthead profile={profile} />

      <section className="cover" aria-labelledby="cover-title">
        {/* 배경 그림. 글자와 같은 뜻을 되풀이하지 않으므로 스크린리더에는 읽히지 않게 한다. */}
        <div className="cover__art" aria-hidden="true">
          <span className="cover__blob cover__blob--a" />
          <span className="cover__blob cover__blob--b" />
          <span className="cover__blob cover__blob--c" />
          <Image src="/logo-mark.svg" alt="" width={520} height={520} className="cover__house" priority unoptimized />
        </div>

        <div className="cover__body">
          <p className="cover__eyebrow">
            <PinIcon />
            광운대 앞 · 노원구 월계1동
          </p>
          <h1 id="cover-title" className="cover__title">
            월계1동에
            <br />
            <span className="cover__title-accent">
              처음 왔나요?
              <SparkIcon />
            </span>
          </h1>
          <p className="cover__lead">
            집 형태와 계약 형태만 알려 주세요.{' '}
            <br />
            나에게 해당하는 할 일만 기한과 함께 알려 드립니다.
          </p>

          {/* 어떤 일을 알려 주는지 — 색만으로 구분하지 않게 글자를 같이 붙인다. 장식이 아니라 목차다. */}
          <ul className="cover__cats" aria-label="알려 드리는 일">
            {CATEGORIES.map((c) => (
              <li key={c} className="cover__cat" data-category={c}>
                <CategoryIcon category={c} />
                {CATEGORY_LABEL[c]}
              </li>
            ))}
          </ul>

          <Link href={returning ? '/tasks' : '/setup'} className="button-link cover__start">
            {returning ? '내 할 일 보기' : '내 할 일 받기'}
            <ChevronIcon />
          </Link>
          <p className="cover__note">회원가입 없이 바로 시작합니다. 상세 주소는 받지 않습니다.</p>
        </div>
      </section>

      <section className={hasPreview ? 'cover-give cover-give--with-list' : 'cover-give'} aria-labelledby="cover-give-title">
        <div className="cover-give__text">
          <p className="cover-give__badge">먼저 와 본 사람이라면</p>
          <h2 id="cover-give-title" className="cover-give__title">
            <span className="cover-give__accent">막혔던 걸</span> 물어본 이웃이 있어요.
          </h2>
          <p className="cover-give__body">
            겪어 본 대로 답해 주면,
            <br />
            확인을 거쳐 다음 사람의 할 일이 됩니다.
          </p>
          <Link href="/questions" className="button-link button-link--secondary cover-give__cta">
            이웃의 질문에 답하기
            <ChevronIcon />
          </Link>
        </div>

        {hasPreview && (
          <ul className="cover-give__questions" aria-label="답을 기다리는 질문">
            {preview.questions.map((q) => (
              <li key={q.id}>
                <Link href={`/questions#q-${q.id}`} className="cover-q">
                  <span className="cover-q__avatar" aria-hidden="true">
                    <PersonIcon />
                  </span>
                  <span className="cover-q__text">
                    <span className="cover-q__title">{q.text}</span>
                    <span className="cover-q__meta">{questionMeta(q, preview.now)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** "3분 전 · 원룸 · 월세". 상황을 안 남긴 질문은 시각만. */
function questionMeta(q: QuestionItem, now: Date): string {
  return [
    timeAgo(q.createdAt, now),
    q.ctxHousingType ? HOUSING_LABEL[q.ctxHousingType] : null,
    q.ctxContractType ? CONTRACT_LABEL[q.ctxContractType] : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/* ---------- 아이콘. 모두 글자 옆에 붙는 장식이라 aria-hidden. ---------- */

function Icon({ children, className = 'icon' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function PinIcon() {
  return (
    <Icon>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

function ChevronIcon() {
  return (
    <Icon className="icon icon--chevron">
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

function SparkIcon() {
  return (
    <Icon className="cover__spark">
      <path d="M6 9 4 4M11 7l3-4M12 12l5-1" />
    </Icon>
  );
}

function PersonIcon() {
  return (
    <Icon>
      <circle cx="12" cy="9" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Icon>
  );
}

function CategoryIcon({ category }: { category: TaskCategory }) {
  switch (category) {
    case 'ADMIN':
      return (
        <Icon>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </Icon>
      );
    case 'WASTE':
      return (
        <Icon>
          <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
        </Icon>
      );
    case 'HOUSING':
      return (
        <Icon>
          <path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />
        </Icon>
      );
    case 'LIFE':
      return (
        <Icon>
          <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />
        </Icon>
      );
  }
}
