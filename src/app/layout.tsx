import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "katex/dist/katex.min.css";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Kyozai Shelf | 大学教材カタログ", template: "%s | Kyozai Shelf" },
  description: "大学・科目・シリーズから、学びたい内容に合う教材をすばやく探せる公開教材カタログです。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Kyozai Shelf",
    title: "Kyozai Shelf | 大学教材カタログ",
    description: "大学・科目・シリーズから探せる、わかりやすい教材カタログ。",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-white shadow-sm">
      <div className="container-page flex min-h-17 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Kyozai Shelf トップ">
          <span className="grid size-9 place-items-center rounded-xl bg-teal text-lg font-black">K</span>
          <span>
            <span className="block text-base font-black leading-none tracking-tight">Kyozai Shelf</span>
            <span className="mt-1 block text-[10px] font-semibold tracking-[0.15em] text-blue-200">UNIVERSITY LEARNING</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold" aria-label="メインナビゲーション">
          <Link href="/catalog" className="rounded-lg px-3 py-2 hover:bg-white/10">教材を探す</Link>
          <Link href="/#universities" className="hidden rounded-lg px-3 py-2 hover:bg-white/10 sm:block">大学</Link>
          <Link href="/#subjects" className="hidden rounded-lg px-3 py-2 hover:bg-white/10 sm:block">科目</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page flex flex-col gap-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div><span className="font-black text-navy">Kyozai Shelf</span><span className="ml-3">学びたい教材を、迷わず見つける。</span></div>
        <div className="flex gap-5"><Link href="/catalog" className="hover:text-navy">全教材</Link><Link href="/admin/login" className="hover:text-navy">管理者</Link></div>
      </div>
    </footer>
  );
}
