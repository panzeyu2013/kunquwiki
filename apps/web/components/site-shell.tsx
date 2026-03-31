import Link from "next/link";
import { ReactNode } from "react";
import { AuthStatus } from "./auth/auth-status";

// Styles
import styles from "../styles/site-shell.module.css";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/events", label: "演出" },
  { href: "/works", label: "剧目" },
  { href: "/people", label: "人物" },
  { href: "/troupes", label: "院团" },
  { href: "/articles", label: "知识" },
  { href: "/stats", label: "统计" }
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <div>
            <Link className={styles.brand} href="/">
              KunquWiki
            </Link>
            <p className={styles.brandSubtitle}>公开可用的昆曲 Wiki 原型站</p>
          </div>
          <nav className={styles.nav}>
            {navItems.map((item) => (
              <Link key={item.href} className={styles.navLink} href={item.href}>
                {item.label}
              </Link>
            ))}
            <AuthStatus />
          </nav>
        </div>
      </header>
      <main className={styles.pageContainer}>{children}</main>
    </div>
  );
}