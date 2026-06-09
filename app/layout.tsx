import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quiz MLN111",
  description: "Website quiz ôn tập từ file Word/PDF"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
