import Link from "next/link";
import { ReactNode } from "react";
import { AuthStatus } from "./auth/auth-status";

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
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <Link className="brand" href="/">
              KunquWiki
            </Link>
            <p className="brand-subtitle">公开可用的昆曲 Wiki 原型站</p>
          </div>
          <nav className="nav">
            {navItems.map((item) => (
              <Link key={item.href} className="nav-link" href={item.href}>
                {item.label}
              </Link>
            ))}
            <AuthStatus />
          </nav>
        </div>
      </header>
      <main className="page-container">{children}</main>
    </div>
  );
}
