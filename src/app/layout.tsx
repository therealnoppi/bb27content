import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
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
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("northstar-theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:"system"}catch{document.documentElement.dataset.theme="system"}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
