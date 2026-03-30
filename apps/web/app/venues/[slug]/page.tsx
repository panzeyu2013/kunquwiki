import { notFound } from "next/navigation";
import { VenueEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { EventRecordSection } from "../../../components/event-record-section";
import { RelatedEntities } from "../../../components/related-entities";
import { MarkdownContent } from "../../../components/markdown-content";
import styles from "../../../styles/detail-page.module.css";

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "venue") {
    notFound();
  }
  const venue = entity as VenueEntity;
  const city = (venue.relatedEntities ?? []).find((item) => item.id === venue.cityId);

  return (
    <div className={styles.page}>
      <div className="detail-layout">
        <section className="detail-panel">
          <h1 className="page-title">{venue.title}</h1>
          <MarkdownContent value={venue.description ?? "待补充"} />
        </section>
        <aside className="detail-panel">
          <h2>场馆信息</h2>
          <p>地址：{venue.address}</p>
          <p>城市：{city?.title ?? venue.city ?? "待补充"}</p>
          <p>容量：{venue.capacity ?? "待补充"}</p>
        </aside>
        <EventRecordSection title="未来演出" events={venue.upcomingEvents} />
        <EventRecordSection title="过往演出" events={venue.pastEvents} />
        <RelatedEntities entity={venue} />
      </div>
    </div>
  );
}
