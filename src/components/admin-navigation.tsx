"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    label: "教材制作",
    links: [
      { href: "/admin", label: "制作ホーム" },
      { href: "/admin/problems", label: "問題データベース" },
      { href: "/admin/mocks", label: "模試・問題集" },
      { href: "/admin/templates", label: "テンプレート" },
    ],
  },
  {
    label: "出版管理",
    links: [
      { href: "/admin/kdp", label: "売上ダッシュボード" },
      { href: "/admin/materials", label: "出版教材" },
      { href: "/admin/imports", label: "KDP CSV取込" },
      { href: "/catalog", label: "公開商品棚", external: true },
    ],
  },
] as const;

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-5 overflow-x-auto px-4 py-3 lg:block lg:space-y-7 lg:px-3 lg:py-5" aria-label="管理ナビゲーション">
      {sections.map((section) => (
        <div className="shrink-0" key={section.label}>
          <p className="hidden px-3 text-[11px] font-semibold tracking-[0.08em] text-muted lg:block">{section.label}</p>
          <div className="flex gap-1 lg:mt-2 lg:block lg:space-y-0.5">
            {section.links.map((item) => {
              const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={"external" in item ? "_blank" : undefined}
                  rel={"external" in item ? "noopener noreferrer" : undefined}
                  className={`block shrink-0 border-l-2 px-3 py-2 text-sm transition ${active ? "border-brand-blue bg-blue-50 font-semibold text-navy" : "border-transparent text-ink hover:bg-slate-50 hover:text-navy"}`}
                >
                  {item.label}{"external" in item && <span className="ml-1 text-xs text-muted">↗</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
