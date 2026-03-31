import Link from "next/link";
import { Entity } from "@kunquwiki/shared";
import { mapEntityTypeLabel } from "../lib/labels";
import { getEntityDetailPath } from "../lib/routes";
import { EntityCard, entityCardStyles } from "./entity-card";

// Styles
import pillStyles from "../styles/components/pill.module.css";
import styles from "../styles/components/entity-grid.module.css";

export function EntityGrid({ items }: { items: Entity[] }) {
  const visibleItems = items.filter((item) => item.entityType !== "city");
  return (
    <div className={styles.grid}>
      {visibleItems.map((item) => (
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
  );
}