import { ProtectedPage } from "../../../components/auth/protected-page";
import { EditProposalForm } from "../../../components/forms/edit-proposal-form";
import { decodeSlugForDisplay } from "../../../lib/slug";

// Styles
import styles from "../../../styles/editor-page.module.css";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const displaySlug = decodeSlugForDisplay(slug);

  return (
    <ProtectedPage
      allowedRoles={["editor", "reviewer", "admin"]}
      title="提交编辑"
      description="提交编辑用于向条目发送结构化修改提案。"
    >
      <div className={styles.editorShell}>
        <div className={styles.editorPageHead}>
          <p className={styles.editorKicker}>Edit</p>
          <h1 className={styles.pageTitle}>提交编辑</h1>
          <p className={styles.editorLead}>当前对象：{displaySlug}</p>
        </div>
        <EditProposalForm slug={slug} />
      </div>
    </ProtectedPage>
  );
}