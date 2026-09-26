import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "월계는 처음이라",
  description: "월계1동에 처음 온 사람을 위한 상황별 생활 안내",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
