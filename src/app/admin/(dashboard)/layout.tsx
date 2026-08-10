import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: { default: "教材制作ワークベンチ", template: "%s | 教材制作" }, robots: { index: false, follow: false, nocache: true } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="admin-shell min-h-screen bg-surface lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex min-h-17 items-center justify-between border-b border-line px-5 py-3 lg:min-h-20">
          <Link href="/admin"><span className="block text-base font-bold tracking-tight text-navy">教材制作室</span><span className="mt-0.5 block text-[11px] text-muted">Mock Studio</span></Link>
          <form action={logoutAction} className="lg:hidden"><button className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-navy" type="submit">ログアウト</button></form>
        </div>
        <Suspense fallback={<div className="px-6 py-5 text-xs text-muted">メニューを読み込み中…</div>}><AdminNavigation /></Suspense>
        <div className="absolute bottom-0 hidden w-[223px] border-t border-line bg-white p-4 lg:block"><p className="truncate text-xs text-muted">{session.email}</p><form action={logoutAction}><button className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm font-semibold text-navy hover:bg-slate-50" type="submit">ログアウト</button></form></div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
