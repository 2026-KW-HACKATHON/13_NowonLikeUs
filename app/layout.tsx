import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

/*
 * 폰트를 지정하지 않으면 윈도우에서 맑은 고딕으로 떨어진다. 자간 · 굵기 단계가 모자라서
 * 큰 숫자와 제목이 무너진다. next/font 는 빌드 때 받아 자체 호스팅하므로
 * 시연 중에 외부 네트워크를 타지 않는다.
 */
const sans = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "월계는 처음이라",
  description: "월계1동에 처음 온 사람을 위한 상황별 생활 안내",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
