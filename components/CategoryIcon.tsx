import type { TaskCategory } from '@/lib/types';

/**
 * 분류 아이콘. 표지의 분류 이름표와 할 일 목록 · 상세의 분류 칩이 같은 그림을 쓴다.
 * 늘 분류 이름 글자 옆에 붙는 장식이라 스크린리더에는 읽히지 않게 한다.
 */
export default function CategoryIcon({ category, className = 'icon' }: { category: TaskCategory; className?: string }) {
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
      {category === 'ADMIN' && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )}
      {category === 'WASTE' && <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />}
      {category === 'HOUSING' && <path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />}
      {category === 'LIFE' && <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />}
    </svg>
  );
}
