import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../dung-chung/CSS/globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CapitalFlow - Nâng tầm quản lý tài chính",
  description: "Giải pháp tài chính thông minh",
  // File-based SVG/PNG/ICO icons share the same mark, including Safari's touch icon.
  formatDetection: { telephone: false, email: false, address: false },
};

// Root layout giữ ngôn ngữ tiếng Việt và cấp provider cho toàn bộ route user-web.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.className} ${inter.variable}`}>
      <body className="bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
