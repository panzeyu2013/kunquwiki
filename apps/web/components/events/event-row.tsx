"use client";

import Link from "next/link";
import { EventEntity } from "@kunquwiki/shared";
import { countdownLabel, formatDateTime } from "../../lib/format";
import { mapEventStatusLabel } from "../../lib/labels";

export function EventRow({ event }: { event: EventEntity }) {
  return (
    <article className="event-row">
      <div>
        <div className="pill-row">
          <span className="pill strong">{mapEventStatusLabel(event.businessStatus)}</span>
          <span className="pill">{countdownLabel(event.startAt)}</span>
        </div>
        <h3>
          <Link href={`/events/${event.slug}`}>{event.title}</Link>
        </h3>
      </div>
      <div className="event-meta">
        <strong>{formatDateTime(event.startAt)}</strong>
        <span>{event.duration ?? "待补充演出时长"}</span>
      </div>
    </article>
  );
}
