import { Entity } from "@kunquwiki/shared";

export function ReferenceList({ entity }: { entity: Entity }) {
  if (!entity.references?.length) {
    return <p>暂无参考资料。</p>;
  }

  return (
    <ul>
      {entity.references.map((reference) => (
        <li key={reference.title}>
          {reference.url ? <a href={reference.url}>{reference.title}</a> : reference.title}
          {reference.publisher ? ` · ${reference.publisher}` : ""}
        </li>
      ))}
    </ul>
  );
}
