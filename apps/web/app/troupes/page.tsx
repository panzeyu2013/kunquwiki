import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";
import { ActionBar } from "../../components/action-bar";

// Styles
import styles from "../../styles/catalog-page.module.css";

export default async function TroupesPage() {
  const troupes = await getEntities({ type: "troupe" });
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>院团与机构</h1>
      <p>收录专业院团、研究机构与相关组织。</p>
      <ActionBar>
        <Link href="/create/troupe">创建剧团</Link>
      </ActionBar>
      <EntityGrid items={troupes} />
    </div>
  );
}