"use client";

import Link from "next/link";
import { clearStoredToken } from "../../lib/auth";
import { useAuthUser } from "./use-auth-user";
import pillStyles from "../../styles/components/pill.module.css";
import ghostButtonStyles from "../../styles/components/ghost-button.module.css";
import styles from "../../styles/site-shell.module.css";

export function AuthStatus() {
  const { user, ready, hasRole } = useAuthUser();

  if (!ready) {
    return <span className={`${pillStyles.pill} ${pillStyles.muted}`}>正在同步登录状态</span>;
  }

  if (!user) {
    return (
      <div className={styles.authBox}>
        <Link href="/login">登录</Link>
      </div>
    );
  }

  return (
    <div className={styles.authBox}>
      {hasRole("editor") ? <Link className={styles.navLink} href="/changes">最近更改</Link> : null}
      {hasRole("reviewer") || hasRole("admin") ? <Link className={styles.navLink} href="/moderation/queue">审核</Link> : null}
      {hasRole("admin") ? <Link className={styles.navLink} href="/admin">后台</Link> : null}
      <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{user.username}</span>
      <button
        type="button"
        className={ghostButtonStyles.button}
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
