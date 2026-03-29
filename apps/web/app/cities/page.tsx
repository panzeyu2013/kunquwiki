import Link from "next/link";
import { CityEntity } from "@kunquwiki/shared";
import { getEntities } from "../../lib/api";

export default async function CitiesPage() {
  const cities = (await getEntities({ type: "city" })) as CityEntity[];

  return (
    <div>
      <h1 className="page-title">城市索引</h1>
      <p>汇总昆曲演出、院团与场馆相关的城市条目。</p>
      <div className="actions">
        <Link href="/create/city">创建城市</Link>
      </div>
      <div className="card-grid">
        {cities.map((city) => (
          <article key={city.id} className="entity-card">
            <div className="pill-row">
              <span className="pill">城市</span>
            </div>
            <h3>
              <Link href={`/cities/${city.slug}`}>{city.title}</Link>
            </h3>
            <p>{city.province || "待补充省份信息"}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
