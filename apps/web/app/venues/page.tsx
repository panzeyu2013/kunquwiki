import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";
import styles from "../../styles/catalog-page.module.css";
import { ActionBar } from "../../components/action-bar";

export default async function VenuesPage() {
  const venues = await getEntities({ type: "venue" });
  return (
    <div className={styles.page}>
      <h1 className="page-title">场馆库</h1>
      <p>支持城市归档、未来地图模式与场馆演出统计扩展。</p>
      <ActionBar>
        <Link href="/create/venue">创建剧场</Link>
      </ActionBar>
      <EntityGrid items={venues} />
    </div>
  );
}
