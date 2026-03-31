import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "../../../lib/api";
import { getEntityDetailPath } from "../../../lib/routes";
import styles from "../../../styles/catalog-page.module.css";
import { ActionBar } from "../../../components/action-bar";
import formStyles from "../../../styles/components/form.module.css";

export default async function DiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity) {
    notFound();
  }

  return (
    <div className={styles.page}>
      <h1 className="page-title">讨论页</h1>
      <p>当前条目：{entity.title}</p>
      <div className={formStyles.form}>
        <ActionBar>
          <Link href={getEntityDetailPath(entity.entityType, entity.slug)}>返回条目</Link>
          <Link href={`/history/${entity.id}`}>查看历史</Link>
        </ActionBar>
        <p>讨论串接口目前还没有接入前端，这一页现在只展示后端中的真实条目信息，不再显示前端写死占位数据。</p>
      </div>
    </div>
  );
}
