import { EventList } from "../../components/event-list";
import { getEntities } from "../../lib/api";
import { EventEntity } from "@kunquwiki/shared";
import { mapEventStatusLabel } from "../../lib/labels";
import Link from "next/link";
import { SectionCard } from "../../components/section-card";

export default async function EventsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const city = typeof params.city === "string" ? params.city : "";
  const status = typeof params.status === "string" ? params.status : "";
  const troupe = typeof params.troupe === "string" ? params.troupe : "";
  const person = typeof params.person === "string" ? params.person : "";
  const work = typeof params.work === "string" ? params.work : "";
  const venue = typeof params.venue === "string" ? params.venue : "";
  const entities = await getEntities({ type: "event", q, city, status, troupe, person, work, venue });
  const events = entities as EventEntity[];

  return (
    <main className="page-container">
      <section className="section-card">
        <div className="section-card-header">
          <h2>演出库</h2>
          <div className="actions">
            <Link href="/create/event">创建演出</Link>
          </div>
        </div>
        <p>按时间管理和公开浏览昆曲演出、纪念活动、讲座与专题项目。</p>
        <form className="edit-form" action="/events">
          <label>
            关键词
            <input name="q" defaultValue={q} placeholder="搜索演出标题或摘要" />
          </label>
          <label>
            城市
            <input name="city" defaultValue={city} placeholder="例如：上海、苏州" />
          </label>
          <label>
            剧团
            <input name="troupe" defaultValue={troupe} placeholder="例如：上海昆剧团" />
          </label>
          <label>
            演员
            <input name="person" defaultValue={person} placeholder="例如：张军" />
          </label>
          <label>
            剧目或折子戏
            <input name="work" defaultValue={work} placeholder="例如：牡丹亭、牡丹亭·游园惊梦" />
          </label>
          <label>
            剧场
            <input name="venue" defaultValue={venue} placeholder="例如：上海大剧院" />
          </label>
          <label>
            状态
            <select name="status" defaultValue={status}>
              <option value="">全部</option>
              <option value="announced">{mapEventStatusLabel("announced")}</option>
              <option value="scheduled">{mapEventStatusLabel("scheduled")}</option>
              <option value="completed">{mapEventStatusLabel("completed")}</option>
              <option value="cancelled">{mapEventStatusLabel("cancelled")}</option>
              <option value="postponed">{mapEventStatusLabel("postponed")}</option>
            </select>
          </label>
          <button type="submit">筛选</button>
        </form>
      </section>
      <SectionCard title="匹配结果">
        <EventList events={events} />
      </SectionCard>
    </main>
  );
}
