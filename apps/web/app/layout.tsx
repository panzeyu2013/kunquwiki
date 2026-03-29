import "./globals.css";
import { SiteShell } from "../components/site-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KunquWiki",
  description: "公开可协作的昆曲知识与演出站"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
