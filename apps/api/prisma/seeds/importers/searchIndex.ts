import { PrismaClient } from "@prisma/client";

export async function importSearchIndex(prisma: PrismaClient) {
  const entities = await prisma.entity.findMany({
    include: {
      content: true,
      aliases: true,
      sourceRefs: { include: { source: true } },
      outgoingRelations: { include: { toEntity: true } },
      incomingRelations: { include: { fromEntity: true } }
    }
  });

  for (const entity of entities) {
    const relationTitles = [
      ...entity.outgoingRelations.map((rel) => rel.toEntity.title),
      ...entity.incomingRelations.map((rel) => rel.fromEntity.title)
    ];
    const searchText = [
      entity.title,
      entity.subtitle,
      entity.content?.bodyMarkdown,
      ...entity.aliases.map((alias) => alias.alias),
      ...entity.sourceRefs.map((ref) => ref.source.title),
      ...relationTitles
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.searchIndex.create({
      data: {
        entityId: entity.id,
        entityType: entity.entityType,
        title: entity.title,
        searchText
      }
    });
  }
}
