"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useAuthUser } from "./use-auth-user";
import styles from "../../styles/editor-page.module.css";

export function ProtectedPage({
  allowedRoles,
  children,
  title,
  description
}: {
  allowedRoles: string[];
  children: ReactNode;
  title: string;
  description: string;
}) {
  const { user, ready, hasRole } = useAuthUser();

  if (!ready) {
    return <div className={styles.page}><p>正在检查权限...</p></div>;
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className="editor-shell">
          <div className="detail-panel editor-notice">
            <h1 className="page-title">{title}</h1>
            <p>{description}</p>
            <p>请先登录后再访问此页面。</p>
            <Link href="/login">前往登录</Link>
          </div>
        </div>
      </div>
    );
  }

  const allowed = allowedRoles.some((role) => hasRole(role));
  if (!allowed) {
    return (
      <div className={styles.page}>
        <div className="editor-shell">
          <div className="detail-panel editor-notice">
            <h1 className="page-title">{title}</h1>
            <p>{description}</p>
            <p>当前登录账号：{user.username}</p>
            <p>当前页面权限不足，请联系管理员授予相应站点身份。</p>
          </div>
        </div>
      </div>
    );
  }

  return <div className={styles.page}>{children}</div>;
}
