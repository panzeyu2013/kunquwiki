import { ProtectedPage } from "../../../components/auth/protected-page";
import { EditProposalForm } from "../../../components/forms/edit-proposal-form";
import { decodeSlugForDisplay } from "../../../lib/slug";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const displaySlug = decodeSlugForDisplay(slug);

  return (
    <ProtectedPage
      allowedRoles={["editor", "reviewer", "admin"]}
      title="提交编辑"
      description="提交编辑用于向条目发送结构化修改提案。"
    >
      <div className="editor-shell">
        <div className="editor-page-head">
          <p className="editor-kicker">Edit</p>
          <h1 className="page-title">提交编辑</h1>
          <p className="editor-lead">当前对象：{displaySlug}</p>
        </div>
        <EditProposalForm slug={slug} />
      </div>
    </ProtectedPage>
  );
}
