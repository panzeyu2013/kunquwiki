import Link from "next/link";
import { CityEntity } from "@kunquwiki/shared";
import { getEntities } from "../../lib/api";
import { EntityCard, entityCardStyles } from "../../components/entity-card";
import { ActionBar } from "../../components/action-bar";

// Styles
import styles from "../../styles/catalog-page.module.css";
import pillStyles from "../../styles/components/pill.module.css";

export default async function CitiesPage() {
  const cities = (await getEntities({ type: "city" })) as CityEntity[];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>城市索引</h1>
      <p>汇总昆曲演出、院团与场馆相关的城市条目。</p>
      <ActionBar>
        <Link href="/create/city">创建城市</Link>
      </ActionBar>
      <div className={styles.cardGrid}>
        {cities.map((city) => (
          <EntityCard key={city.id}>
            <div className={pillStyles.row}>
              <span className={pillStyles.pill}>城市</span>
            </div>
            <h3 className={entityCardStyles.title}>
              <Link href={`/cities/${city.slug}`}>{city.title}</Link>
            </h3>
            <p className={entityCardStyles.bodyText}>{city.province || "待补充省份信息"}</p>
          </EntityCard>
        ))}
      </div>
    </div>
  );
}