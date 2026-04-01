import { notFound } from "next/navigation";
import { VenueEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { EventRecordSection } from "../../../components/events/event-record-section";
import { RelatedEntities } from "../../../components/related-entities";
import { MarkdownContent } from "../../../components/markdown-content";

// Styles
import styles from "../../../styles/detail-page.module.css";

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "venue") {
    notFound();
  }
  const venue = entity as VenueEntity;
  const city = (venue.relatedEntities ?? []).find((item) => item.id === venue.cityId);
  const cityLabel = city?.title ?? venue.cityText ?? "待补充";

  return (
    <div className={styles.page}>
      <div className={styles.detailLayout}>
        <section className={styles.detailPanel}>
          <h1 className={styles.pageTitle}>{venue.title}</h1>
          <MarkdownContent value={venue.body} />
        </section>
        <aside className={styles.detailPanel}>
          <h2>场馆信息</h2>
          <p>地址：{venue.address}</p>
          <p>城市：{cityLabel}</p>
          <p>容量：{venue.capacity ?? "待补充"}</p>
        </aside>
        <EventRecordSection title="未来演出" events={venue.upcomingEvents} />
        <EventRecordSection title="过往演出" events={venue.pastEvents} />
        <RelatedEntities entity={venue} />
      </div>
    </div>
  );
}
