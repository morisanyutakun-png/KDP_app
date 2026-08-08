import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-surface p-6"><div className="card max-w-lg p-10 text-center"><p className="eyebrow">404</p><h1 className="mt-3 text-3xl font-black text-navy">ページが見つかりません</h1><p className="mt-3 text-sm leading-relaxed text-muted">URLが変更されたか、公開されていない教材の可能性があります。</p><Link href="/" className="btn-primary mt-7">トップへ戻る</Link></div></main>;
}
