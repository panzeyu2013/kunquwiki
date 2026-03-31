import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { EventRecordSection } from "../../../components/events/event-record-section";
import { ReferenceList } from "../../../components/reference-list";
import { RelatedEntities } from "../../../components/related-entities";
import { mapWorkTypeLabel } from "../../../lib/labels";
import { MarkdownContent } from "../../../components/markdown-content";
import { ActionBar } from "../../../components/action-bar";

// Styles
import styles from "../../../styles/detail-page.module.css";
import pillStyles from "../../../styles/components/pill.module.css";

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "work") {
    notFound();
  }
  const work = entity as WorkEntity;
  const parentWork = work.relatedEntities?.find((item) => item.id === work.parentWorkId);
  const childWorks = (work.relatedEntities ?? []).filter((item) => item.entityType === "work" && item.id !== work.parentWorkId);
  const workTypeLabel = mapWorkTypeLabel(work.workType);

  return (
    <div className={styles.page}>
      <div className={styles.detailLayout}>
        <section className={styles.detailPanel}>
        <div className={pillStyles.row}>
          <span className={pillStyles.pill}>{workTypeLabel}</span>
        </div>
          <h1 className={styles.pageTitle}>{work.title}</h1>
          {parentWork ? (
            <>
              <h2>所属正戏</h2>
              <p>
                <Link href={`/works/${parentWork.slug}`}>{parentWork.title}</Link>
              </p>
            </>
          ) : null}
          {work.workType === "full_play" && childWorks.length > 0 ? (
            <>
              <h2>附属折子戏</h2>
              <ul>
                {childWorks.map((item) => (
                  <li key={item.id}>
                    <Link href={`/works/${item.slug}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h2>剧情梗概</h2>
          <MarkdownContent value={work.plot} />
          <h2>参考资料</h2>
          <ReferenceList entity={work} />
          <ActionBar>
            <Link href={`/edit/${work.slug}`}>提交编辑</Link>
            <Link href={`/history/${work.id}`}>版本历史</Link>
            <Link href={`/discussion/${work.slug}`}>讨论页</Link>
          </ActionBar>
        </section>
        <aside className={styles.detailPanel}>
          <h2>信息框</h2>
          <p>作者：{work.originalAuthor ?? "待补充"}</p>
          <p>时期：{work.dynastyPeriod ?? "待补充"}</p>
          <p>简介：{work.synopsis}</p>
        </aside>
        <EventRecordSection title="未来演出" events={work.upcomingEvents} />
        <EventRecordSection title="过往演出" events={work.pastEvents} />
        <RelatedEntities entity={work} />
      </div>
    </div>
  );
}