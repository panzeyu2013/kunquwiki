import { EntityGrid } from "../components/entity-grid";
import { EventList } from "../components/event-list";
import { SectionCard } from "../components/section-card";
import { getHomeData } from "../lib/api";

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <main className="page-container">
      <section className="hero">
        <h1>{data.hero.title}</h1>
        <p>{data.hero.subtitle}</p>
      </section>

      <section className="metrics">
        <article className="metric-card">
          <span>已发布条目</span>
          <strong>{data.stats.totalPublishedEntries}</strong>
        </article>
        <article className="metric-card">
          <span>即将到来的演出</span>
          <strong>{data.stats.totalUpcomingEvents}</strong>
        </article>
        <article className="metric-card">
          <span>剧目条目</span>
          <strong>{data.stats.totalWorks}</strong>
        </article>
        <article className="metric-card">
          <span>人物条目</span>
          <strong>{data.stats.totalPeople}</strong>
        </article>
      </section>

      <SectionCard title="近期演出倒计时">
        <EventList events={data.featuredEvents} />
      </SectionCard>

      <SectionCard title="热门剧目">
        <EntityGrid items={data.featuredWorks} />
      </SectionCard>

      <SectionCard title="重点人物">
        <EntityGrid items={data.featuredPeople} />
      </SectionCard>
    </main>
  );
}
