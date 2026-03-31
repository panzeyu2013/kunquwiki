import Link from "next/link";
import { searchEntities } from "../../lib/api";
import { mapEntityTypeLabel } from "../../lib/labels";
import { getEntityDetailPath, isRoutableEntityType } from "../../lib/routes";
import styles from "../../styles/catalog-page.module.css";
import { EntityCard, entityCardStyles } from "../../components/entity-card";
import pillStyles from "../../styles/components/pill.module.css";
import formStyles from "../../styles/components/form.module.css";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const results = (await searchEntities(q)).filter((result) => isRoutableEntityType(result.entityType));

  return (
    <div className={styles.page}>
      <h1 className="page-title">搜索</h1>
      <form className={formStyles.form} action="/search">
        <label>
          关键词
          <input defaultValue={q} name="q" placeholder="输入城市、剧目、人物、院团、剧场或术语" />
        </label>
        <button type="submit">搜索</button>
      </form>
      <div className="stack">
        {results.map((result) => (
          <EntityCard key={result.id}>
            <div className={pillStyles.row}>
              <span className={pillStyles.pill}>{mapEntityTypeLabel(result.entityType)}</span>
            </div>
            <h3 className={entityCardStyles.title}>
              <Link href={getEntityDetailPath(result.entityType, result.slug)}>{result.title}</Link>
            </h3>
          </EntityCard>
        ))}
      </div>
    </div>
  );
}
