import { ProtectedPage } from "../../../components/auth/protected-page";
import { ModerationQueueClient } from "../../../components/forms/moderation-queue-client";

export default function ModerationQueuePage() {
  return (
    <ProtectedPage
      allowedRoles={["reviewer", "admin"]}
      title="审核队列"
      description="审核队列仅对审核员和管理员开放，用于处理用户提交的编辑提案。"
    >
      <div className="editor-shell">
        <div className="editor-page-head">
          <p className="editor-kicker">Review</p>
          <h1 className="page-title">审核队列</h1>
          <p className="editor-lead">这里已经接入真实审核接口，拥有审核或管理员身份后可直接审批。</p>
        </div>
        <ModerationQueueClient />
      </div>
    </ProtectedPage>
  );
}
