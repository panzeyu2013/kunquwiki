import { EventEntity } from "@kunquwiki/shared";
import { EventRow } from "./event-row";

export function EventList({ events }: { events: EventEntity[] }) {
  return (
    <div className="stack">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}
