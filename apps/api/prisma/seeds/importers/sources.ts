import { PrismaClient } from "@prisma/client";
import { SeedSource } from "../types";
import { parseOptionalDate } from "../utils/date";

export async function importSources(prisma: PrismaClient, sources: SeedSource[]) {
  const sourceByKey = new Map<string, string>();
  for (const source of sources) {
    const created = await prisma.source.create({
      data: {
        sourceType: source.sourceType,
        title: source.title,
        publisher: source.publisher ?? null,
        author: source.author ?? null,
        sourceUrl: source.sourceUrl ?? null,
        publicationDate: parseOptionalDate(source.publicationDate) ?? null,
        reliabilityLevel: source.reliabilityLevel,
        archivedUrl: source.archivedUrl ?? null,
        notes: source.notes ?? null
      }
    });
    sourceByKey.set(source.key, created.id);
  }
  return sourceByKey;
}
