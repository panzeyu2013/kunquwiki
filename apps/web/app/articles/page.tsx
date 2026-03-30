import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";
import styles from "../../styles/catalog-page.module.css";

export default async function ArticlesPage() {
  const articles = await getEntities({ type: "article" });
  return (
    <div className={styles.page}>
      <h1 className="page-title">知识条目</h1>
      <p>收录行当、曲牌、身段、历史背景等非演出型知识内容。</p>
      <div className="actions">
        <Link href="/create/article">创建知识条目</Link>
      </div>
      <EntityGrid items={articles} />
    </div>
  );
}
