import { ProtectedPage } from "../../components/auth/protected-page";
import { RecentChangesClient } from "../../components/forms/recent-changes-client";

// Styles
import styles from "../../styles/components/editor-shared.module.css";

export default function ChangesPage() {
  return (
    <ProtectedPage
      allowedRoles={["editor", "reviewer", "admin"]}
      title="最近更改"
      description="最近更改页用于追踪条目修订、审核状态和版本历史。"
    >
      <div className={styles.editorShell}>
        <div className={styles.editorPageHead}>
          <p className={styles.editorKicker}>History</p>
          <h1 className={styles.pageTitle}>最近更改</h1>
        </div>
        <RecentChangesClient />
      </div>
    </ProtectedPage>
  );
}