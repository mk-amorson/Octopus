import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../styles/globals.css";

const octopusPixel = localFont({
  src: "./fonts/octopus-pixel.ttf",
  variable: "--font-octopus-pixel",
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
    <html lang="en" className={octopusPixel.variable}>
      <body>{children}</body>
    </html>
  );
}
