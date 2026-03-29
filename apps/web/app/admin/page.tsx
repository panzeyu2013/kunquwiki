import Link from "next/link";
import { ProtectedPage } from "../../components/auth/protected-page";
import { AdminDashboard } from "../../components/forms/admin-dashboard";

export default function AdminPage() {
  return (
    <ProtectedPage
      allowedRoles={["admin"]}
      title="后台管理"
      description="后台管理页用于用户授权、全站审计和运维概览。"
    >
      <div className="editor-shell">
        <div className="editor-page-head">
          <p className="editor-kicker">Admin</p>
          <h1 className="page-title">后台管理</h1>
          <p className="editor-lead">这里汇总提案审核、审计日志、最近修订和用户权限管理。</p>
        </div>
        <div className="actions">
          <Link href="/moderation/queue">打开审核队列</Link>
          <Link href="/changes">查看最近更改</Link>
        </div>
        <AdminDashboard />
      </div>
    </ProtectedPage>
  );
}
