import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../styles/globals.css";

const basis33 = localFont({
  src: "./fonts/basis33.ttf",
  variable: "--font-basis33",
  display: "block",
});

export const metadata: Metadata = {
  title: "Octopus",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={basis33.variable}>
      <body>{children}</body>
    </html>
  );
}
