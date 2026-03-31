import Link from "next/link";
import { RelatedEventRecord } from "@kunquwiki/shared";
import { formatDateTime } from "../../lib/format";
import tableStyles from "../../styles/components/table.module.css";

export function EventRecordSection({ title, events }: { title: string; events?: RelatedEventRecord[] }) {
  if (!events?.length) {
    return null;
  }

  return (
    <section className="detail-panel">
      <h2>{title}</h2>
      <div className={tableStyles.shell}>
        <table>
          <thead>
            <tr>
              <th>演出</th>
              <th>时间</th>
              <th>剧场</th>
              <th>城市</th>
              <th>剧团</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <Link href={`/events/${event.slug}`}>{event.title}</Link>
                </td>
                <td>{formatDateTime(event.startAt)}</td>
                <td>{event.venue ?? "待补充"}</td>
                <td>{event.city ?? "待补充"}</td>
                <td>{event.troupe ?? "待补充"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
