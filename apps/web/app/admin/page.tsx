import Link from "next/link";
import { ProtectedPage } from "../../components/auth/protected-page";
import { AdminDashboard } from "../../components/forms/admin-dashboard";
import { ActionBar } from "../../components/action-bar";

// Styles
import styles from "../../styles/components/editor-shared.module.css";

export default function AdminPage() {
  return (
    <ProtectedPage
      allowedRoles={["admin"]}
      title="后台管理"
      description="后台管理页用于用户授权、全站审计和运维概览。"
    >
      <div className={styles.editorShell}>
        <div className={styles.editorPageHead}>
          <p className={styles.editorKicker}>Admin</p>
          <h1 className={styles.pageTitle}>后台管理</h1>
          <p className={styles.editorLead}>这里汇总提案审核、审计日志、最近修订和用户权限管理。</p>
        </div>
        <ActionBar>
          <Link href="/moderation/queue">打开审核队列</Link>
          <Link href="/changes">查看最近更改</Link>
        </ActionBar>
        <AdminDashboard />
      </div>
    </ProtectedPage>
  );
}