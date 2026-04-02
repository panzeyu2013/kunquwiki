import { PrismaClient, PublishStatus } from "@prisma/client";
import { parseOptionalDate } from "./date";
import { SeedBaseEntity, SeedSourceRef } from "../types";

export type SeedContext = {
  prisma: PrismaClient;
  userByUsername: Map<string, string>;
  sourceByKey: Map<string, string>;
  mediaByKey: Map<string, string>;
  entityIdBySlug: Map<string, string>;
};

export type CreateEntityInput = SeedBaseEntity & {
  entityType: "work" | "person" | "troupe" | "venue" | "event" | "city" | "article" | "role" | "topic";
  nested: Record<string, unknown>;
};

function buildSourceRefs(sourceRefs: SeedSourceRef[] | undefined, ctx: SeedContext) {
  if (!sourceRefs || sourceRefs.length === 0) return undefined;
  return {
    create: sourceRefs.map((ref, index) => ({
      sourceId: (() => {
        const sourceId = ctx.sourceByKey.get(ref.sourceKey);
        if (!sourceId) {
          throw new Error(`Unknown sourceKey ${ref.sourceKey} while creating entity sources`);
        }
        return sourceId;
      })(),
      refNote: ref.refNote ?? null,
      citationText: ref.citationText ?? null,
      sortOrder: ref.sortOrder ?? index
    }))
  };
}

export async function createBaseEntity(ctx: SeedContext, input: CreateEntityInput) {
  const createdBy = input.createdBy ?? "admin";
  const updatedBy = input.updatedBy ?? createdBy;
  const createdById = ctx.userByUsername.get(createdBy);
  const updatedById = ctx.userByUsername.get(updatedBy);
  if (!createdById || !updatedById) {
    throw new Error(`Unknown user for entity ${input.slug}: ${createdBy} / ${updatedBy}`);
  }

  const coverImageId = input.coverImageKey ? ctx.mediaByKey.get(input.coverImageKey) : undefined;

  const entity = await ctx.prisma.entity.create({
    data: {
      entityType: input.entityType,
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle ?? null,
      status: input.status ?? PublishStatus.published,
      visibility: input.visibility ?? "public",
      coverImageId: coverImageId ?? null,
      createdById,
      updatedById,
      publishedAt: parseOptionalDate(input.publishedAt) ?? new Date(),
      content: input.content
        ? {
            create: {
              bodyMarkdown: input.content.bodyMarkdown
            }
          }
        : undefined,
      aliases: input.aliases?.length
        ? {
            create: input.aliases.map((alias) => ({
              alias: alias.alias,
              aliasType: alias.aliasType,
              isPrimary: alias.isPrimary ?? false
            }))
          }
        : undefined,
      sourceRefs: buildSourceRefs(input.sources, ctx),
      ...input.nested
    }
  });

  ctx.entityIdBySlug.set(input.slug, entity.id);
  return entity;
}
