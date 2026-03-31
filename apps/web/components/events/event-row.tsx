"use client";

import Link from "next/link";
import { EventEntity } from "@kunquwiki/shared";
import { countdownLabel, formatDateTime } from "../../lib/format";
import { mapEventStatusLabel } from "../../lib/labels";

// Styles
import styles from "../../styles/components/event-row.module.css";

export function EventRow({ event }: { event: EventEntity }) {
  return (
    <article className={styles.row}>
      <div className={styles.content}>
        <div className={styles.pillRow}>
          <span className={`${styles.pill} ${styles.pillPrimary}`}>
            {mapEventStatusLabel(event.businessStatus)}
          </span>
          <span className={styles.pill}>{countdownLabel(event.startAt)}</span>
        </div>
        <h3 className={styles.title}>
          <Link className={styles.titleLink} href={`/events/${event.slug}`}>
            {event.title}
          </Link>
        </h3>
      </div>
      <div className={styles.meta}>
        <strong className={styles.metaPrimary}>{formatDateTime(event.startAt)}</strong>
        <span className={styles.metaSecondary}>{event.duration ?? "待补充演出时长"}</span>
      </div>
    </article>
  );
}
