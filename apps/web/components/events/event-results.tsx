"use client";

import { useMemo, useState } from "react";
import { EventEntity } from "@kunquwiki/shared";
import { EventRow } from "./event-row";
import { SectionCard } from "../section-card";

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
    <SectionCard className="results-shell">
      <div className="results-header">
        <span className="results-count">匹配结果（{events.length}条）</span>
        <div className="sort-form">
          <div className="segmented sort-segmented" role="radiogroup" aria-label="排序方式">
            <label className="segmented-item">
              <input
                type="radio"
                name="sort"
                value="time"
                checked={sortKey === "time"}
                onChange={() => setSortKey("time")}
              />
              <span>按时间</span>
            </label>
            <label className="segmented-item">
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
      <div className="stack">
        {sortedEvents.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </SectionCard>
  );
}
