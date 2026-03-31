"use client";

import { useMemo, useState } from "react";
import { EventEntity } from "@kunquwiki/shared";
import { EventRow } from "./event-row";
import { SectionCard } from "../section-card";

// Styles
import styles from "../../styles/detail-page.module.css";

type SortKey = "time" | "updated";

export function EventResults({ events, initialSort }: { events: EventEntity[]; initialSort?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>(initialSort === "updated" ? "updated" : "time");

  const sortedEvents = useMemo(() => {
    const items = [...events];
    if (sortKey === "updated") {
      return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events, sortKey]);

  return (
    <SectionCard className={styles.resultsShell}>
      <div className={styles.resultsHeader}>
        <span className={styles.resultsCount}>匹配结果（{events.length}条）</span>
        <div className={styles.sortForm}>
          <div className={`${styles.segmented} ${styles.sortSegmented}`} role="radiogroup" aria-label="排序方式">
            <label className={styles.segmentedItem}>
              <input
                type="radio"
                name="sort"
                value="time"
                checked={sortKey === "time"}
                onChange={() => setSortKey("time")}
              />
              <span>按时间</span>
            </label>
            <label className={styles.segmentedItem}>
              <input
                type="radio"
                name="sort"
                value="updated"
                checked={sortKey === "updated"}
                onChange={() => setSortKey("updated")}
              />
              <span>最近更新</span>
            </label>
          </div>
        </div>
      </div>
      <div className={styles.stack}>
        {sortedEvents.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </SectionCard>
  );
}
