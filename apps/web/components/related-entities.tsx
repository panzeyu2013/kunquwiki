import Link from "next/link";
import { Entity } from "@kunquwiki/shared";
import { mapEntityTypeLabel } from "../lib/labels";
import { getEntityDetailPath, isRoutableEntityType } from "../lib/routes";
import { EntityCard, entityCardStyles } from "./entity-card";

// Styles
import pillStyles from "../styles/components/pill.module.css";
import styles from "../styles/detail-page.module.css";

export function RelatedEntities({ entity }: { entity: Entity }) {
  const items = (entity.relatedEntities ?? []).filter((item) => isRoutableEntityType(item.entityType));
  if (!items.length) {
    return null;
  }

  return (
    <section className={styles.detailPanel}>
      <h2>相关条目</h2>
      <div className={styles.stack}>
        {items.map((item) => (
          <EntityCard key={item.id}>
            <div className={pillStyles.row}>
              <span className={pillStyles.pill}>{mapEntityTypeLabel(item.entityType)}</span>
            </div>
            <h3 className={entityCardStyles.title}>
              <Link href={getEntityDetailPath(item.entityType, item.slug)}>{item.title}</Link>
            </h3>
          </EntityCard>
        ))}
      </div>
    </section>
  );
}