import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";

export default async function WorksPage() {
  const works = await getEntities({ type: "work" });
  return (
    <div>
      <h1 className="page-title">剧目库</h1>
      <p>收录全本戏、折子戏、版本关系与经典演出关联。</p>
      <div className="actions">
        <Link href="/create/work">创建剧目</Link>
      </div>
      <EntityGrid items={works} />
    </div>
  );
}
