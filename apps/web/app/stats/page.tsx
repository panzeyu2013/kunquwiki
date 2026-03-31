import { SectionCard } from "../../components/section-card";
import { getStats } from "../../lib/api";
import styles from "../../styles/detail-page.module.css";

export default async function StatsPage() {
  const stats = await getStats();
  return (
    <div className={styles.page}>
      <h1 className="page-title">统计页</h1>
      <p>首版先覆盖演出规模、活跃城市和剧目热度，后续可扩展合作图谱与时间轴。</p>
      <section className="metrics">
        <article className="metric-card">
          <span>即将到来的演出</span>
          <strong>{stats.totalUpcomingEvents}</strong>
        </article>
        <article className="metric-card">
          <span>历史演出</span>
          <strong>{stats.totalHistoricalEvents}</strong>
        </article>
        <article className="metric-card">
          <span>人物总量</span>
          <strong>{stats.totalPeople}</strong>
        </article>
        <article className="metric-card">
          <span>院团总量</span>
          <strong>{stats.totalTroupes}</strong>
        </article>
      </section>
      <div className="detail-layout">
        <SectionCard title="热门剧目">
          <div className="stack">
            {stats.topWorks.map((item) => (
              <div key={item.title} className={styles.statsRow}>
                <strong>{item.title}</strong>
                <span>{item.count} 次</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="活跃城市">
          <div className="stack">
            {stats.topCities.map((item) => (
              <div key={item.city} className={styles.statsRow}>
                <strong>{item.city}</strong>
                <span>{item.count} 场</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
