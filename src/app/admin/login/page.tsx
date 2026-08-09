import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "管理者ログイン", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const query = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_35%),linear-gradient(135deg,#f5f7fb,#fff)] p-5">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-navy"><span className="grid size-11 place-items-center rounded-2xl bg-navy text-xl font-black text-white">M</span><div><p className="text-xl font-black">Mock Studio</p><p className="text-xs text-muted">AUTHORING WORKBENCH</p></div></div>
        <div className="card p-6 sm:p-8">
          <p className="eyebrow">ADMIN ONLY</p><h1 className="mt-2 text-2xl font-black text-navy">教材制作画面にログイン</h1><p className="mt-2 text-sm leading-relaxed text-muted">環境変数に設定した管理者アカウントを使用してください。</p>
          {query.error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">メールアドレスまたはパスワードが正しくありません。</div>}
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
