import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "管理者ログイン", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const query = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-5">
      <div className="w-full max-w-sm">
        <div className="mb-5 border-b border-line pb-4"><p className="text-lg font-bold text-navy">教材制作室</p><p className="mt-1 text-xs text-muted">問題・模試制作管理</p></div>
        <div className="card p-6 sm:p-7">
          <p className="eyebrow">管理者専用</p><h1 className="mt-1.5 text-xl font-bold text-navy">ログイン</h1><p className="mt-2 text-sm leading-relaxed text-muted">登録済みの管理者アカウントを入力してください。</p>
          {query.error && <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">メールアドレスまたはパスワードが正しくありません。</div>}
          <form action={loginAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={query.next || "/admin"} />
            <div><label className="label" htmlFor="email">メールアドレス</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div>
            <div><label className="label" htmlFor="password">パスワード</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <button className="btn-primary w-full" type="submit">ログイン</button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-muted">このページは検索エンジンに登録されません。</p>
      </div>
    </main>
  );
}
