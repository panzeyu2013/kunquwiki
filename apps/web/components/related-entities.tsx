import Link from "next/link";
import { Entity } from "@kunquwiki/shared";
import { mapEntityTypeLabel } from "../lib/labels";
import { getEntityDetailPath, isRoutableEntityType } from "../lib/routes";

export function RelatedEntities({ entity }: { entity: Entity }) {
  const items = (entity.relatedEntities ?? []).filter((item) => isRoutableEntityType(item.entityType));
  if (!items.length) {
    return null;
  }

  return (
    <section className="detail-panel">
      <h2>相关条目</h2>
      <div className="stack">
        {items.map((item) => (
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
    </section>
  );
}
