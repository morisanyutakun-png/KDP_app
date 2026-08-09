import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: { default: "教材制作ワークベンチ", template: "%s | 教材制作" }, robots: { index: false, follow: false, nocache: true } };

const navigation = [
  { href: "/admin", label: "制作ホーム", icon: "▦" },
  { href: "/admin/problems", label: "Problem Bank", icon: "⌕" },
  { href: "/admin/mocks", label: "Mock Builder", icon: "▤" },
  { href: "/admin/templates", label: "テンプレート", icon: "◇" },
  { href: "/admin/kdp", label: "KDP売上", icon: "↗" },
  { href: "/admin/materials", label: "出版教材", icon: "▥" },
  { href: "/admin/imports", label: "KDP CSV", icon: "↥" },
  { href: "/catalog", label: "公開商品棚", icon: "↗" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="bg-navy text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between border-b border-white/10 p-4 lg:block lg:border-0 lg:p-6">
          <Link href="/admin" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-teal font-black">M</span><span><span className="block font-black">Mock Studio</span><span className="block text-[10px] tracking-wider text-blue-200">AUTHORING WORKBENCH</span></span></Link>
          <form action={logoutAction} className="lg:hidden"><button className="rounded-lg border border-white/20 px-3 py-2 text-xs" type="submit">ログアウト</button></form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:px-4 lg:py-4" aria-label="管理ナビゲーション">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-100 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center">{item.icon}</span>{item.label}</Link>)}
        </nav>
        <div className="absolute bottom-0 hidden w-[250px] border-t border-white/10 p-4 lg:block"><p className="truncate px-2 text-xs text-blue-200">{session.email}</p><form action={logoutAction}><button className="mt-3 w-full rounded-xl border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10" type="submit">ログアウト</button></form></div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
