"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";
import { BrandLogo } from "./brand-logo";

export function AuthForm({
  register = false,
  next = "/",
}: {
  register?: boolean;
  next?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const destination =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const email = field("email").trim();
    const password = field("password");
    try {
      const result = register
        ? await authClient.signUp.email({
            email,
            password,
            name: field("name").trim(),
          })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(
          register
            ? "注册未完成，请检查昵称、邮箱和密码，或使用已有账户登录。"
            : "登录失败，请检查邮箱和密码后重试。",
        );
        return;
      }
      await utils.invalidate();
      router.replace(destination);
      router.refresh();
    } catch {
      setError("暂时无法连接，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/" aria-label="BNDS.life 首页">
          <BrandLogo />
          <span>BNDS.life</span>
        </Link>
        <h1 id="auth-title">{register ? "创建账户" : "登录"}</h1>
        <p className="auth-intro">
          {register
            ? "一起留下十一小日子的回忆"
            : "登录 BNDS.life，留下你的校园回忆"}
        </p>
        <form onSubmit={submit} className="auth-form">
          {register && (
            <label>
              昵称
              <input
                name="name"
                autoComplete="nickname"
                required
                minLength={1}
                maxLength={40}
                placeholder="你的昵称"
              />
            </label>
          )}
          <label>
            邮箱
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="你的邮箱地址"
            />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 8 : 1}
              maxLength={128}
              placeholder={register ? "至少 8 个字符" : "输入密码"}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-actions">
            <Link
              className="text-button"
              href={`${register ? "/login" : "/register"}?next=${encodeURIComponent(destination)}`}
            >
              {register ? "已有账户？登录" : "创建账户"}
            </Link>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "请稍候…" : register ? "注册" : "登录"}
            </button>
          </div>
        </form>
      </section>
      <Link className="auth-back" href="/">
        返回浏览视频
      </Link>
    </div>
  );
}
