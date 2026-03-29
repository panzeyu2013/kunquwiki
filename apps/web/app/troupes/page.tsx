import { EntityGrid } from "../../components/entity-grid";
import { getEntities } from "../../lib/api";
import Link from "next/link";

export default async function TroupesPage() {
  const troupes = await getEntities({ type: "troupe" });
  return (
    <div>
      <h1 className="page-title">院团与机构</h1>
      <p>收录专业院团、研究机构与相关组织。</p>
      <div className="actions">
        <Link href="/create/troupe">创建剧团</Link>
      </div>
      <EntityGrid items={troupes} />
    </div>
  );
}
