import Masthead from '@/components/Masthead';
import PromotionDesk from '@/components/PromotionDesk';

export const metadata = { title: '승격 · 월계는 처음이라' };

/**
 * 운영자 승격 화면. 주민 답변이 달린 질문을 골라, 확인한 내용을 다음 사람의 할 일로 발행한다.
 *
 * 권한은 서버가 판정한다(`requireAdmin`, 역할은 DB 재조회). 화면의 로그인 확인은 안내용이다.
 */
export default function PromotionsPage() {
  return (
    <main>
      <Masthead profile={null} />
      <h1 className="page-title">승격</h1>
      <p className="lead">
        주민 답변이 달린 질문을 할 일로 정리합니다. 발행한 할 일은 조건에 맞는 다음 사람의 목록에 바로 나갑니다.
      </p>
      <PromotionDesk />
    </main>
  );
}
