import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
// @ts-expect-error CSS imports are handled by Next.js.
import "./globals.css";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Projekt-Roadmap`,
  description: siteConfig.subtitle,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
