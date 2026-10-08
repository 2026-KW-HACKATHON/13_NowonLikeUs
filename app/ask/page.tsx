import { connection } from 'next/server';
import AskScreen from '@/components/AskScreen';
import { sendsQuestionsToGoogle } from '@/lib/askView';

export const metadata = { title: '질문하기 · 월계는 처음이라' };

/**
 * 질문하기. 화면은 `AskScreen`(브라우저), 여기서는 외부 전송 여부만 서버에서 읽어 넘긴다.
 *
 * 환경변수는 서버에만 있다. `connection()` 으로 요청 시점에 읽어서, 빌드 결과에 값이 박히지 않게 한다 —
 * 고지 문구가 그 환경(미리보기 · 운영)의 실제 스위치 값을 따르도록 (node_modules/next/dist/docs 환경변수 문서).
 */
export default async function AskPage() {
  await connection();
  const sendsToGoogle = sendsQuestionsToGoogle({
    GEMINI_ALLOW_USER_INPUT: process.env.GEMINI_ALLOW_USER_INPUT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
  return <AskScreen sendsToGoogle={sendsToGoogle} />;
}
