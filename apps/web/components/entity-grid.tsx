import Link from "next/link";
import { Entity } from "@kunquwiki/shared";
import { mapEntityTypeLabel } from "../lib/labels";
import { getEntityDetailPath } from "../lib/routes";

export function EntityGrid({ items }: { items: Entity[] }) {
  const visibleItems = items.filter((item) => item.entityType !== "city");
  return (
    <div className="card-grid">
      {visibleItems.map((item) => (
        <article key={item.id} className="entity-card">
          <div className="pill-row">
            <span className="pill">{mapEntityTypeLabel(item.entityType)}</span>
          </div>
          <h3>
            <Link href={getEntityDetailPath(item.entityType, item.slug)}>{item.title}</Link>
          </h3>
        </article>
      ))}
    </div>
  );
}
