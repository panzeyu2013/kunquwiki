import { EventEntity } from "@kunquwiki/shared";
import { EventRow } from "./event-row";

// Styles
import styles from "../../styles/components/event-list.module.css";

export function EventList({ events }: { events: EventEntity[] }) {
  return (
    <div className={styles.list}>
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}