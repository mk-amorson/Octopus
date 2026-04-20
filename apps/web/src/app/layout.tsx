import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "amorson.me",
  description: "Personal hub & no-code agent editor.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
