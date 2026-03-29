import { ProtectedPage } from "../../../components/auth/protected-page";
import { EditProposalForm } from "../../../components/forms/edit-proposal-form";

export default async function CreateEntityPage({ params }: { params: Promise<{ entityType: string }> }) {
  const { entityType } = await params;

  return (
    <ProtectedPage
      allowedRoles={["editor", "reviewer", "admin"]}
      title="新建条目"
      description="直接使用完整表单新建条目。"
    >
      <div className="editor-shell">
        <div className="editor-page-head">
          <p className="editor-kicker">Create</p>
          <h1 className="page-title">新建条目</h1>
          <p className="editor-lead">这里不再使用 quick create，创建时就可以录入完整结构化信息。</p>
        </div>
        <EditProposalForm entityType={entityType} />
      </div>
    </ProtectedPage>
  );
}
