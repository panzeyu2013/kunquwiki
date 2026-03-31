import { getEntities } from "../../lib/api";
import { EventEntity } from "@kunquwiki/shared";
import { mapEventStatusLabel } from "../../lib/labels";
import Link from "next/link";
import { SearchSuggestInput } from "../../components/events/search-suggest-input";
import { EventResults } from "../../components/events/event-results";
import { SectionCard } from "../../components/section-card";
import { ActionBar } from "../../components/action-bar";

// Styles
import styles from "../../styles/detail-page.module.css";
import buttonStyles from "../../styles/components/button.module.css";
import ghostButtonStyles from "../../styles/components/ghost-button.module.css";
import formStyles from "../../styles/components/form.module.css";

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
  const sort = typeof params.sort === "string" ? params.sort : "time";
  const entities = await getEntities({ type: "event", q, city, status, troupe, person, work, venue });
  const events = entities as EventEntity[];
  const hasAdvancedFilters = Boolean(city || troupe || person || work || venue || status);
  const statusLabel = status
    ? mapEventStatusLabel(status as "announced" | "scheduled" | "completed" | "cancelled" | "postponed")
    : "";
  const activeFilters: Array<{ key: string; label: string }> = [
    q ? { key: "q", label: `关键词：${q}` } : null,
    city ? { key: "city", label: `城市：${city}` } : null,
    troupe ? { key: "troupe", label: `剧团：${troupe}` } : null,
    person ? { key: "person", label: `演员：${person}` } : null,
    work ? { key: "work", label: `剧目：${work}` } : null,
    venue ? { key: "venue", label: `剧场：${venue}` } : null,
    status ? { key: "status", label: `状态：${statusLabel}` } : null
  ].filter((item): item is { key: string; label: string } => Boolean(item));

  const buildSearchUrl = (overrides: Partial<Record<string, string | undefined>>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = { q, city, status, troupe, person, work, venue, sort };
    Object.entries(base).forEach(([key, value]) => {
      const overrideValue = overrides.hasOwnProperty(key) ? overrides[key] : value;
      if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
        next.set(key, overrideValue);
      }
    });
    const qs = next.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  return (
    <div className={styles.page}>
      <SectionCard
        className={styles.eventHero}
        header={
          <div className={styles.eventHeader}>
            <div>
              <h2 className={styles.pageTitle}>演出库</h2>
              <p>按时间管理和公开浏览昆曲演出、纪念活动、讲座与专题项目。</p>
            </div>
            <ActionBar>
              <Link href="/create/event">创建演出</Link>
            </ActionBar>
          </div>
        }
      />

      <SectionCard className={styles.searchShell}>
        <form action="/events" className={`${styles.eventSearch} ${formStyles.form}`}>
          <div className={styles.searchRow}>
            <SearchSuggestInput
              name="q"
              type="event"
              defaultValue={q}
              placeholder="搜索演出标题、摘要或关键词"
            />
            <input type="hidden" name="sort" value={sort} />
            <label className={styles.filterToggle} htmlFor="event-filter-toggle">
              筛选
            </label>
            <Link className={`${ghostButtonStyles.button} ${ghostButtonStyles.raised} ${styles.searchResetButton}`} href="/events">
              重置
            </Link>
          </div>
          <input
            id="event-filter-toggle"
            className={styles.filterToggleInput}
            type="checkbox"
            defaultChecked={hasAdvancedFilters}
          />
          <div className={styles.filterPanel}>
            <div className={styles.filterGrid}>
              <label>
                城市
                <SearchSuggestInput
                  name="city"
                  type="city"
                  minChars={1}
                  inputClassName={styles.filterInput}
                  defaultValue={city}
                  placeholder="例如：上海、苏州"
                />
              </label>
              <label>
                剧团
                <SearchSuggestInput
                  name="troupe"
                  type="troupe"
                  minChars={1}
                  inputClassName={styles.filterInput}
                  defaultValue={troupe}
                  placeholder="例如：上海昆剧团"
                />
              </label>
              <label>
                演员
                <SearchSuggestInput
                  name="person"
                  type="person"
                  minChars={1}
                  inputClassName={styles.filterInput}
                  defaultValue={person}
                  placeholder="例如：张军"
                />
              </label>
              <label>
                剧目或折子戏
                <SearchSuggestInput
                  name="work"
                  type="work"
                  minChars={1}
                  inputClassName={styles.filterInput}
                  defaultValue={work}
                  placeholder="例如：牡丹亭、牡丹亭·游园惊梦"
                />
              </label>
              <label>
                剧场
                <SearchSuggestInput
                  name="venue"
                  type="venue"
                  minChars={1}
                  inputClassName={styles.filterInput}
                  defaultValue={venue}
                  placeholder="例如：上海大剧院"
                />
              </label>
              <fieldset className={styles.statusField}>
                <legend>状态</legend>
                <div className={styles.statusOptions}>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="" defaultChecked={!status} />
                    <span>全部</span>
                  </label>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="announced" defaultChecked={status === "announced"} />
                    <span>{mapEventStatusLabel("announced")}</span>
                  </label>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="scheduled" defaultChecked={status === "scheduled"} />
                    <span>{mapEventStatusLabel("scheduled")}</span>
                  </label>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="completed" defaultChecked={status === "completed"} />
                    <span>{mapEventStatusLabel("completed")}</span>
                  </label>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="cancelled" defaultChecked={status === "cancelled"} />
                    <span>{mapEventStatusLabel("cancelled")}</span>
                  </label>
                  <label className={styles.statusChip}>
                    <input type="radio" name="status" value="postponed" defaultChecked={status === "postponed"} />
                    <span>{mapEventStatusLabel("postponed")}</span>
                  </label>
                </div>
              </fieldset>
            </div>
            <div className={styles.filterActions}>
              <button type="submit" className={buttonStyles.button}>
                应用筛选
              </button>
              <Link className={`${ghostButtonStyles.button} ${ghostButtonStyles.raised}`} href="/events">
                清空条件
              </Link>
            </div>
          </div>
        </form>
      </SectionCard>

      <SectionCard className={styles.filterSummary}>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>当前筛选：</span>
          {activeFilters.length === 0 ? (
            <span className={`${styles.chip} ${styles.chipMuted}`}>暂无筛选条件</span>
          ) : (
            activeFilters.map((filter) => (
              <span key={filter.key} className={styles.chip}>
                {filter.label}
                <Link className={styles.chipRemove} href={buildSearchUrl({ [filter.key]: "" })}>
                  ×
                </Link>
              </span>
            ))
          )}
          {activeFilters.length > 0 ? (
            <Link className={styles.chipClear} href="/events">
              清除全部
            </Link>
          ) : null}
        </div>
      </SectionCard>

      <EventResults events={events} initialSort={sort} />
    </div>
  );
}