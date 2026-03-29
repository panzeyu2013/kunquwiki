import Link from "next/link";
import { notFound } from "next/navigation";
import { EventEntity } from "@kunquwiki/shared";
import { getEntity } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { ReferenceList } from "../../../components/reference-list";
import { RelatedEntities } from "../../../components/related-entities";
import { mapEventStatusLabel, mapEventTypeLabel } from "../../../lib/labels";
import { PreciseCountdown } from "../../../components/precise-countdown";
import { MarkdownContent } from "../../../components/markdown-content";

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntity(slug);
  if (!entity || entity.entityType !== "event") {
    notFound();
  }
  const event = entity as EventEntity;
  const relatedEntities = event.relatedEntities ?? [];
  const troupeIds = Array.isArray(event.troupeIds) ? event.troupeIds : [];
  const program = Array.isArray(event.program) ? event.program : [];
  const city = relatedEntities.find((item) => item.id === event.cityId);
  const venue = relatedEntities.find((item) => item.id === event.venueId);
  const troupeNames = Array.from(
    new Set(
      relatedEntities
        .filter((item) => item.entityType === "troupe" && troupeIds.includes(item.id))
        .map((item) => item.title)
    )
  );
  const fullWorks = relatedEntities.filter((item) =>
    program.some((programItem) => programItem.workId === item.id && programItem.workType !== "excerpt")
  );
  const excerpts = relatedEntities.filter((item) =>
    program.some((programItem) => programItem.workId === item.id && programItem.workType === "excerpt")
  );

  return (
    <div className="detail-layout">
      <section className="detail-panel">
        <div className="pill-row">
          <span className="pill strong">{mapEventStatusLabel(event.businessStatus)}</span>
          <PreciseCountdown value={event.startAt} />
        </div>
        <h1 className="page-title">{event.title}</h1>
        <MarkdownContent value={event.body} />
        <h2>节目单</h2>
        <ul>
          {program.map((program) => (
            <li key={program.id}>
              {program.sequenceNo}. {program.title}
            </li>
          ))}
        </ul>
        <h2>演员表</h2>
        {program.some((programItem) => (programItem.casts ?? []).length > 0) ? (
          <ul>
            {program.flatMap((program) =>
              (program.casts ?? []).map((cast) => {
                const person = relatedEntities.find((item) => item.id === cast.personId);
                const role = relatedEntities.find((item) => item.id === cast.roleId);
                return (
                  <li key={cast.id}>
                    {program.title} · {role?.title ?? "未标注角色"} · {person?.title ?? "待补充演员"}
                  </li>
                );
              })
            )}
          </ul>
        ) : (
          <p>待补充</p>
        )}
        <h2>参考资料</h2>
        <ReferenceList entity={event} />
        <div className="actions">
          <Link href={`/edit/${event.slug}`}>提交编辑</Link>
          <Link href={`/history/${event.id}`}>版本历史</Link>
          <Link href={`/discussion/${event.slug}`}>讨论页</Link>
        </div>
      </section>
      <aside className="detail-panel">
        <h2>演出信息</h2>
        <p>类型：{mapEventTypeLabel(event.eventType)}</p>
        <p>时间：{formatDateTime(event.startAt)}</p>
        <p>城市：{city?.title ?? "待补充"}</p>
        <p>剧场：{venue?.title ?? "待补充"}</p>
        <p>剧团：{troupeNames.join("、") || "待补充"}</p>
        <p>演出剧目：{fullWorks.map((item) => item.title).join("、") || "待补充"}</p>
        <p>演出折子戏：{excerpts.map((item) => item.title).join("、") || "待补充"}</p>
        <p>演出时长：{event.duration ?? "待补充"}</p>
        <p>余票：{event.ticketStatus ?? "待补充"}</p>
        <p>备注：{event.noteText ?? "待补充"}</p>
        {event.ticketUrl ? <p><a href={event.ticketUrl}>票务链接</a></p> : null}
      </aside>
      <RelatedEntities entity={event} />
    </div>
  );
}
