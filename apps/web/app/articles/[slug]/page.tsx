import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { ReferenceList } from "../../../components/reference-list";
import { RelatedEntities } from "../../../components/related-entities";
import { mapArticleTypeLabel } from "../../../lib/labels";
import { MarkdownContent } from "../../../components/markdown-content";
import styles from "../../../styles/detail-page.module.css";
import { ActionBar } from "../../../components/action-bar";

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "article") {
    notFound();
  }
  const article = entity as ArticleEntity;

  return (
    <div className={styles.page}>
      <div className="detail-layout">
        <section className="detail-panel">
          <h1 className="page-title">{article.title}</h1>
          <MarkdownContent value={article.body} />
          <h2>参考资料</h2>
          <ReferenceList entity={article} />
          <ActionBar>
            <Link href={`/edit/${article.slug}`}>提交编辑</Link>
            <Link href={`/history/${article.id}`}>版本历史</Link>
            <Link href={`/discussion/${article.slug}`}>讨论页</Link>
          </ActionBar>
        </section>
        <aside className="detail-panel">
          <h2>条目信息</h2>
          <p>类型：{mapArticleTypeLabel(article.articleType)}</p>
        </aside>
        <RelatedEntities entity={article} />
      </div>
    </div>
  );
}
