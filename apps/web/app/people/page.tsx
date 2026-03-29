import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";

export default async function PeoplePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const city = typeof params.city === "string" ? params.city : "";
  const people = await getEntities({ type: "person", q, city });
  return (
    <div>
      <h1 className="page-title">人物库</h1>
      <p>收录演员、教师、推广者、学者等与昆曲相关人物。</p>
      <div className="actions">
        <Link href="/create/person">创建人物</Link>
      </div>
      <form className="edit-form" action="/people">
        <label>
          关键词
          <input name="q" defaultValue={q} placeholder="搜索人物姓名、简介或身份" />
        </label>
        <label>
          城市
          <input name="city" defaultValue={city} placeholder="例如：上海、苏州" />
        </label>
        <button type="submit">筛选</button>
      </form>
      <EntityGrid items={people} />
    </div>
  );
}
