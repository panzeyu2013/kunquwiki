import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";
import styles from "../../styles/catalog-page.module.css";
import { ActionBar } from "../../components/action-bar";

export default async function WorksPage() {
  const works = await getEntities({ type: "work" });
  return (
    <div className={styles.page}>
      <h1 className="page-title">剧目库</h1>
      <p>收录全本戏、折子戏、版本关系与经典演出关联。</p>
      <ActionBar>
        <Link href="/create/work">创建剧目</Link>
      </ActionBar>
      <EntityGrid items={works} />
    </div>
  );
}
