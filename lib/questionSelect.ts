/**
 * 질문 + 답변을 화면 모양(QuestionRow)으로 꺼낼 때 쓰는 Prisma select.
 * 질문 목록과 승격 큐가 같은 모양을 내려주도록 한 곳에 둔다. 작성자는 닉네임만 꺼낸다(이메일 금지).
 */
export const questionRowSelect = {
  id: true,
  text: true,
  ctxHousingType: true,
  ctxContractType: true,
  aiAnswer: true,
  confidence: true,
  status: true,
  createdAt: true,
  asker: { select: { nickname: true } },
  answers: {
    where: { isHidden: false },
    select: {
      id: true,
      questionId: true,
      text: true,
      isHidden: true,
      createdAt: true,
      author: { select: { nickname: true } },
      confirmations: { select: { userId: true } },
    },
  },
} as const;
