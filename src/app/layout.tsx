import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import PublicLayout from "@/components/PublicLayout";
import { version } from "../../package.json";

export const metadata: Metadata = {
  metadataBase: new URL('https://www.keylink.kr'),
  title: "키링크 | 부산 프리미엄 로테이션 소개팅",
  description:
    "2025년 론칭 후 120기 돌파! 부산 지역 소규모 프리미엄 로테이션 소개팅 키링크. 중복만남 100% 환불, 미매칭 30% 환불 보장.",
  keywords: ["소개팅", "로테이션소개팅", "부산소개팅", "키링크"],
  openGraph: {
    title: "키링크 | 부산 프리미엄 로테이션 소개팅",
    description: "2025년 론칭 후 120기 돌파! 소규모 프리미엄 로테이션 소개팅",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <PublicLayout>{children}</PublicLayout>
        <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none select-none text-black font-black text-lg bg-white/80 px-3 py-1 rounded-md shadow-sm">
          v{version}
        </div>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#FFFFFF',
              color: '#333333',
              border: '1px solid #eeeeee',
              borderRadius: '16px',
              padding: '16px 24px',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            },
            success: {
              iconTheme: { primary: '#4CAF50', secondary: '#FFFFFF' },
            },
            error: {
              icon: '⚠️',
              style: {
                background: '#FFF5F4',
                color: '#FF6F61',
                border: '1px solid #FFEBE9',
              }
            }
          }}
        />
      </body>
    </html>
  );
}
