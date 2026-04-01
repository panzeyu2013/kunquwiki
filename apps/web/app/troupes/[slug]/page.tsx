import Link from "next/link";
import { notFound } from "next/navigation";
import { TroupeEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { EventRecordSection } from "../../../components/events/event-record-section";
import { ReferenceList } from "../../../components/reference-list";
import { RelatedEntities } from "../../../components/related-entities";
import { mapTroupeTypeLabel } from "../../../lib/labels";
import { MarkdownContent } from "../../../components/markdown-content";
import { ActionBar } from "../../../components/action-bar";

// Styles
import styles from "../../../styles/detail-page.module.css";

export default async function TroupeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "troupe") {
    notFound();
  }
  const troupe = entity as TroupeEntity;
  const city = (troupe.relatedEntities ?? []).find((item) => item.id === troupe.cityId);
  const cityLabel = city?.title ?? troupe.cityText ?? "待补充";
  const regionLabel = troupe.regionText?.trim() || "待补充";

  return (
    <div className={styles.page}>
      <div className={styles.detailLayout}>
        <section className={styles.detailPanel}>
          <h1 className={styles.pageTitle}>{troupe.title}</h1>
          <MarkdownContent value={troupe.body} />
          <h2>参考资料</h2>
          <ReferenceList entity={troupe} />
          <ActionBar>
            <Link href={`/edit/${troupe.slug}`}>提交编辑</Link>
            <Link href={`/history/${troupe.id}`}>版本历史</Link>
            <Link href={`/discussion/${troupe.slug}`}>讨论页</Link>
          </ActionBar>
        </section>
        <aside className={styles.detailPanel}>
          <h2>信息框</h2>
          <p>城市：{cityLabel}</p>
          <p>地区：{regionLabel}</p>
          <p>机构类型：{mapTroupeTypeLabel(troupe.troupeType)}</p>
        </aside>
        <EventRecordSection title="未来演出" events={troupe.upcomingEvents} />
        <EventRecordSection title="过往演出" events={troupe.pastEvents} />
        <RelatedEntities entity={troupe} />
      </div>
    </div>
  );
}
