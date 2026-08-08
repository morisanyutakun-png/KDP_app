"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyCredentials } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeRedirectPath(String(formData.get("next") || ""));
  if (!email || !password || !(await verifyCredentials(email, password))) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }
  await createSession(email);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
