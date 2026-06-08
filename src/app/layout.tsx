import type { Metadata } from "next";
import { fontDisplay, fontText } from "@/theme/fonts";
import { seo } from "@/theme/seo";
import "./globals.css";
import "@/theme/tokens.css";
import "@/theme/typography.css";

export const metadata: Metadata = {
  title: { default: seo.defaultTitle, template: `%s — ${seo.siteName}` },
  description: seo.defaultDescription,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontText.variable}`}
    >
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
