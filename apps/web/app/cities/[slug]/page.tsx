import Link from "next/link";
import { notFound } from "next/navigation";
import { CityEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { RelatedEntities } from "../../../components/related-entities";
import styles from "../../../styles/detail-page.module.css";
import { ActionBar } from "../../../components/action-bar";

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "city") {
    notFound();
  }
  const city = entity as CityEntity;
  const relatedEntities = city.relatedEntities ?? [];
  const venueNames = relatedEntities.filter((item) => item.entityType === "venue").map((item) => item.title);
  const troupeNames = relatedEntities.filter((item) => item.entityType === "troupe").map((item) => item.title);

  return (
    <div className={styles.page}>
      <div className="detail-layout">
        <section className="detail-panel">
          <h1 className="page-title">{city.title}</h1>
          <p>{city.province || "待补充省份信息"}</p>
          <ActionBar>
            <Link href={`/edit/${city.slug}`}>提交编辑</Link>
            <Link href={`/history/${city.id}`}>版本历史</Link>
            <Link href={`/discussion/${city.slug}`}>讨论页</Link>
          </ActionBar>
        </section>
        <aside className="detail-panel">
          <h2>城市信息</h2>
          <p>省级区域：{city.province || "待补充"}</p>
          <p>相关场馆：{venueNames.join("、") || "待补充"}</p>
          <p>相关院团：{troupeNames.join("、") || "待补充"}</p>
        </aside>
        <RelatedEntities entity={city} />
      </div>
    </div>
  );
}
