'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 화면 아래에 늘 붙어 있는 탭 세 개. 할 일 · 물어보기 · 이웃 질문을 어디서든 한 번에 오간다.
 *
 * 직접 써 본 사람들이 질문 화면을 못 찾았다. 링크가 할 일 목록 맨 아래에만 있어서
 * 끝까지 내려야 보였기 때문이다. 엄지가 닿는 아래쪽에 고정해 스크롤과 상관없이 보이게 한다.
 *
 * 표지 · 상황 입력 · 로그인 · 운영자 화면에는 띄우지 않는다. 각자 다음 행동이 하나뿐인 화면이다.
 * 본문(main) 뒤에 오므로 키보드 · 스크린리더 사용자가 본문보다 먼저 지나치지 않는다.
 */
const TABS = [
  { href: '/tasks', label: '할 일', match: (p: string) => p === '/tasks' || p.startsWith('/tasks/'), icon: <ListIcon /> },
  { href: '/ask', label: '물어보기', match: (p: string) => p === '/ask', icon: <AskIcon /> },
  { href: '/questions', label: '이웃 질문', match: (p: string) => p === '/questions', icon: <NeighborIcon /> },
];

export default function TabBar() {
  const pathname = usePathname();
  if (!TABS.some((tab) => tab.match(pathname))) return null;

  return (
    <>
      {/* 고정된 탭이 본문 마지막 줄을 덮지 않게 같은 높이만큼 자리를 비워 둔다. */}
      <div className="tabbar-spacer" aria-hidden="true" />
      <nav className="tabbar" aria-label="주요 화면">
        <ul className="tabbar__list">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link href={tab.href} className="tabbar__item" aria-current={active ? 'page' : undefined}>
                  {tab.icon}
                  <span className="tabbar__label">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function ListIcon() {
  return (
    <svg className="tabbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11 7h9M11 13h9M11 19h9" />
    </svg>
  );
}

function AskIcon() {
  return (
    <svg className="tabbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M10 9a2 2 0 1 1 2.5 1.9c-.3.1-.5.4-.5.7V12M12 14.2v.1" />
    </svg>
  );
}

function NeighborIcon() {
  return (
    <svg className="tabbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 13.8c2 .7 3.5 2.6 3.5 5.2" />
    </svg>
  );
}
