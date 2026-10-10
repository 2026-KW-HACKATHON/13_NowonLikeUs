import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import TabBar from "@/components/TabBar";
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

/*
 * viewportFit: cover 여야 아이폰에서 env(safe-area-inset-bottom) 값이 잡힌다.
 * 하단 탭이 홈 막대에 깔리지 않게 그만큼 띄우는 데 쓴다. 확대는 막지 않는다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={sans.variable}>
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
