import { Manrope, Inter } from "next/font/google";

export const fontDisplay = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display-var",
  display: "swap",
});

export const fontText = Inter({
  subsets: ["cyrillic", "latin"],
  variable: "--font-text-var",
  display: "swap",
});
