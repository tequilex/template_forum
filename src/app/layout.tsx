import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skelet",
  description: "Skeleton",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
