"use client";

import Link from "next/link";
import { clearStoredToken } from "../../lib/auth";
import { useAuthUser } from "./use-auth-user";

export function AuthStatus() {
  const { user, ready, hasRole } = useAuthUser();

  if (!ready) {
    return <span className="pill muted">正在同步登录状态</span>;
  }

  if (!user) {
    return (
      <div className="auth-box">
        <Link href="/login">登录</Link>
      </div>
    );
  }

  return (
    <div className="auth-box">
      {hasRole("editor") ? <Link className="nav-link" href="/changes">最近更改</Link> : null}
      {hasRole("reviewer") || hasRole("admin") ? <Link className="nav-link" href="/moderation/queue">审核</Link> : null}
      {hasRole("admin") ? <Link className="nav-link" href="/admin">后台</Link> : null}
      <span className="pill strong">{user.username}</span>
      <button
        type="button"
        className="ghost-button"
        onClick={() => {
          clearStoredToken();
          window.location.href = "/";
        }}
      >
        退出
      </button>
    </div>
  );
}
