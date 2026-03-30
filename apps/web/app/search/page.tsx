import Link from "next/link";
import { searchEntities } from "../../lib/api";
import { mapEntityTypeLabel } from "../../lib/labels";
import { getEntityDetailPath, isRoutableEntityType } from "../../lib/routes";
import styles from "../../styles/catalog-page.module.css";

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
      <form className="edit-form" action="/search">
        <label>
          关键词
          <input defaultValue={q} name="q" placeholder="输入城市、剧目、人物、院团、剧场或术语" />
        </label>
        <button type="submit">搜索</button>
      </form>
      <div className="stack">
        {results.map((result) => (
          <article key={result.id} className="entity-card">
            <div className="pill-row">
              <span className="pill">{mapEntityTypeLabel(result.entityType)}</span>
            </div>
            <h3>
              <Link href={getEntityDetailPath(result.entityType, result.slug)}>{result.title}</Link>
            </h3>
          </article>
        ))}
      </div>
    </div>
  );
}
