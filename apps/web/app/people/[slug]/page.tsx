import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { EventRecordSection } from "../../../components/events/event-record-section";
import { ReferenceList } from "../../../components/reference-list";
import { RelatedEntities } from "../../../components/related-entities";
import { MarkdownContent } from "../../../components/markdown-content";
import styles from "../../../styles/detail-page.module.css";

export default async function PersonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "person") {
    notFound();
  }
  const person = entity as PersonEntity;
  const birthCity = (person.relatedEntities ?? []).find((item) => item.id === person.birthCityId);
  const troupeNames = (person.relatedEntities ?? [])
    .filter((item) => item.entityType === "troupe")
    .map((item) => item.title);
  const representativeWorks = (person.relatedEntities ?? []).filter((item) => person.representativeWorkIds.includes(item.id));
  const representativeExcerpts = (person.relatedEntities ?? []).filter((item) => person.representativeExcerptIds.includes(item.id));

  return (
    <div className={styles.page}>
      <div className="detail-layout">
        <section className="detail-panel">
          <div className="pill-row">
            {person.roles.map((role) => (
              <span key={role} className="pill">
                {role}
              </span>
            ))}
          </div>
          <h1 className="page-title">{person.title}</h1>
          <MarkdownContent value={person.bio} />
          <h2>参考资料</h2>
          <ReferenceList entity={person} />
          <div className="actions">
            <Link href={`/edit/${person.slug}`}>提交编辑</Link>
            <Link href={`/history/${person.id}`}>版本历史</Link>
            <Link href={`/discussion/${person.slug}`}>讨论页</Link>
          </div>
        </section>
        <aside className="detail-panel">
          <h2>信息框</h2>
          <p>性别：{person.gender ?? "待补充"}</p>
          <p>出生地：{birthCity?.title ?? "待补充"}</p>
          <p>所属院团：{troupeNames.join("、") || "待补充"}</p>
          <p>代表剧目：{representativeWorks.map((item) => item.title).join("、") || "待补充"}</p>
          <p>代表折子戏：{representativeExcerpts.map((item) => item.title).join("、") || "待补充"}</p>
        </aside>
        <EventRecordSection title="未来演出" events={person.upcomingEvents} />
        <EventRecordSection title="过往演出" events={person.pastEvents} />
        <RelatedEntities entity={person} />
      </div>
    </div>
  );
}
