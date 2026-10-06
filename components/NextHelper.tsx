import Link from 'next/link';

/**
 * 할 일을 모두 끝낸 사람에게 보여주는 자리.
 *
 * 받는 쪽은 한 번 쓰고 끝나도 괜찮다. 대신 다 끝낸 사람이 "주는 쪽"으로 넘어가게 해서
 * 서비스가 이어지게 한다 (멘토링 피드백 — 일회성 앱 지적에 대한 답).
 *
 * 지금 연결할 수 있는 기여는 "목록에 없던 것을 질문으로 남기기"다. 남긴 질문은 DB 에 쌓여
 * 주민 답변 → 운영자 승격을 거쳐 다음 사람의 할 일이 된다.
 * 다른 사람의 질문에 답하는 화면(`/questions`)이 생기면 그쪽 버튼을 여기에 더한다.
 */
export default function NextHelper() {
  return (
    <section className="next-helper" aria-labelledby="next-helper-title">
      <h2 id="next-helper-title" className="next-helper__title">
        모두 끝냈어요. 이제 다음 사람 차례예요
      </h2>
      <p className="next-helper__body">
        목록에 없던 것 중에 겪어 보니 꼭 알아야 했던 게 있었나요? 질문으로 남겨 주시면 주민 답변과 확인을
        거쳐 다음에 오는 사람의 할 일 목록에 더해집니다.
      </p>
      <Link href="/ask" className="button-link">
        질문으로 남기기
      </Link>
    </section>
  );
}
