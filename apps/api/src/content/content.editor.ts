import { NotFoundException } from "@nestjs/common";
import { ArticleType, EntityType, EventStatus, EventType, IdentityTerm, Prisma, PublishStatus, TroupeType, WorkType } from "@prisma/client";
import { applyStructuredProposal } from "./content.mutations";
import { generateUniqueSlug, listEntityOptions, replaceEntityRelations } from "./content.helpers";
import {
  excerptText,
  parseDateForCreate,
  toNullableDecimal,
  toNullableInt,
  toNullableString,
  toObjectArray,
  toPersonIdentities,
  toStringArray,
  toTroupeMemberships
} from "./content.utils";
import { ensureEntityReference, validateRelationshipPayload } from "./content.validation";
import { PrismaService } from "../prisma.service";

type SearchIndexer = {
  rebuildEntity(entityId: string, tx?: Prisma.TransactionClient): Promise<unknown>;
};

export type QuickCreateInput = {
  entityType: EntityType;
  title: string;
  workType?: string;
  parentWorkId?: string;
  initialData?: Record<string, unknown>;
};

/**
 * 返回后台编辑器依赖的所有下拉选项与枚举集合。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `entityType`: 当前编辑的实体类型，可选。
 * - `excludeEntityId`: 需要从候选集中排除的实体 ID。
 *
 * 输出：
 * - 返回编辑器初始化所需的枚举值和实体候选集。
 *
 * 控制逻辑：
 * 1. 统一通过 `listEntityOptions` 读取实体下拉项。
 * 2. 剧目会再细分成整本戏与折子戏两组，降低表单侧二次筛选负担。
 */
export async function getEditorOptions(prisma: PrismaService, entityType?: string, excludeEntityId?: string) {
  const [works, people, troupes, venues, cities, roleEntities] = await Promise.all([
    listEntityOptions(prisma, "work", excludeEntityId),
    listEntityOptions(prisma, "person"),
    listEntityOptions(prisma, "troupe"),
    listEntityOptions(prisma, "venue"),
    listEntityOptions(prisma, "city"),
    listEntityOptions(prisma, "role")
  ]);

  const [fullWorks, excerpts] = await Promise.all([
    listEntityOptions(prisma, "work", excludeEntityId, { work: { workType: WorkType.full_play } }),
    listEntityOptions(prisma, "work", excludeEntityId, { work: { workType: WorkType.excerpt } })
  ]);

  return {
    entityType,
    identityOptions: [
      IdentityTerm.actor,
      IdentityTerm.teacher,
      IdentityTerm.director,
      IdentityTerm.writer,
      IdentityTerm.researcher,
      IdentityTerm.promoter
    ],
    workTypeOptions: [WorkType.full_play, WorkType.excerpt, WorkType.adapted_piece],
    troupeTypeOptions: [TroupeType.troupe, TroupeType.school, TroupeType.research_org],
    articleTypeOptions: [ArticleType.term, ArticleType.costume, ArticleType.music, ArticleType.history, ArticleType.technique],
    eventTypeOptions: [EventType.performance, EventType.festival, EventType.lecture, EventType.memorial],
    eventStatusOptions: [
      EventStatus.announced,
      EventStatus.scheduled,
      EventStatus.completed,
      EventStatus.cancelled,
      EventStatus.postponed
    ],
    works,
    fullWorks,
    excerpts,
    people,
    troupes,
    venues,
    cities,
    roleEntities
  };
}

/**
 * 快速创建一个最小可编辑实体，并初始化其子表和基础关系。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `searchIndex`: 搜索索引重建器。
 * - `input`: 实体类型、标题和初始结构化数据。
 * - `createdById`: 当前创建人 ID。
 *
 * 输出：
 * - 返回新创建实体的 `{ id, slug, title }`。
 *
 * 控制逻辑：
 * 1. 折子戏强制校验父剧目，并自动拼接标题。
 * 2. 非活动类型先做同类同标题去重。
 * 3. 初始数据统一走关系校验，再落库主表、正文和子表。
 * 4. 后续结构化更新复用 `applyStructuredProposal`，保持快速创建与审核写回一致。
 * 5. 最后写审计日志并重建搜索索引。
 *
 * 所需组件：
 * - `validateRelationshipPayload`
 * - `applyStructuredProposal`
 * - `replaceEntityRelations`
 * - `generateUniqueSlug`
 */
export async function createQuickEntity(
  prisma: PrismaService,
  searchIndex: SearchIndexer,
  input: QuickCreateInput,
  createdById: string
) {
  const trimmedTitle = input.title.trim();
  const normalizedType = input.entityType;
  let finalTitle = trimmedTitle;
  let workType = input.workType as WorkType | undefined;

  if (normalizedType === "work" && input.workType === WorkType.excerpt) {
    if (!input.parentWorkId) {
      throw new NotFoundException("折子戏需要先选择所属剧目");
    }
    const parent = await ensureEntityReference(prisma, input.parentWorkId, EntityType.work, "parentWorkId");
    finalTitle = `${parent.title}·${trimmedTitle}`;
    workType = WorkType.excerpt;
  }

  if (normalizedType !== "event") {
    const existing = await prisma.entity.findFirst({
      where: {
        entityType: normalizedType,
        title: finalTitle
      },
      select: { id: true, slug: true, title: true }
    });

    if (existing) {
      return existing;
    }
  }

  const initialData = await validateRelationshipPayload(prisma, normalizedType, input.initialData ?? {});
  const explicitBodyMarkdown =
    Object.prototype.hasOwnProperty.call(initialData, "bodyMarkdown") && typeof initialData.bodyMarkdown === "string"
      ? initialData.bodyMarkdown
      : null;
  const bodyMarkdown =
    explicitBodyMarkdown ??
    (normalizedType !== "event" && typeof initialData.bodyMarkdown === "string" && initialData.bodyMarkdown.trim().length > 0
      ? initialData.bodyMarkdown
      : "待补充");
  const parsedStartAt = typeof initialData.startAt === "string" ? parseDateForCreate(initialData.startAt, "startAt", true) : null;
  const initialStartAt = parsedStartAt ?? new Date();
  const initialEventType =
    typeof initialData.eventType === "string" && initialData.eventType.length > 0
      ? (initialData.eventType as EventType)
      : EventType.performance;
  const initialEventStatus =
    typeof initialData.businessStatus === "string" && initialData.businessStatus.length > 0 ? initialData.businessStatus : EventStatus.scheduled;
  const initialTroupeIds = Array.isArray(initialData.troupeIds)
    ? toStringArray(initialData.troupeIds)
    : typeof initialData.troupeId === "string" && initialData.troupeId.length > 0
      ? [initialData.troupeId]
      : [];
  const slug =
    normalizedType === "event"
      ? await generateUniqueSlug(prisma, {
          format: "event",
          startAt: initialStartAt,
          troupeEntityId: initialTroupeIds[0] ?? null,
          title: finalTitle
        })
      : await generateUniqueSlug(prisma, { format: "generic", title: finalTitle });

  const entity = await prisma.entity.create({
    data: {
      entityType: normalizedType,
      slug,
      title: finalTitle,
      status: PublishStatus.draft,
      visibility: "public",
      coverImageId: toNullableString(initialData.coverImageId),
      createdById,
      updatedById: createdById,
      content: {
        create: {
          bodyMarkdown
        }
      },
      ...(normalizedType === "city"
        ? {
            city: {
              create: {
                province: toNullableString(initialData.province) ?? "待补充"
              }
            }
          }
        : {}),
      ...(normalizedType === "troupe"
        ? {
            troupe: {
              create: {
                troupeType: (toNullableString(initialData.troupeType) as TroupeType | null) ?? TroupeType.troupe,
                foundedDate: parseDateForCreate(initialData.foundedDate, "foundedDate"),
                dissolvedDate: parseDateForCreate(initialData.dissolvedDate, "dissolvedDate"),
                cityEntityId: toNullableString(initialData.cityId),
                cityText: toNullableString(initialData.cityText ?? initialData.city) ?? "",
                regionText: toNullableString(initialData.regionText ?? initialData.region) ?? "",
                description: toNullableString(initialData.description) ?? "",
                officialWebsite: toNullableString(initialData.officialWebsite)
              }
            }
          }
        : {}),
      ...(normalizedType === "venue"
        ? {
            venue: {
              create: {
                venueType: toNullableString(initialData.venueType) ?? "theater",
                countryText: toNullableString(initialData.countryText ?? initialData.country) ?? "中国",
                cityEntityId: toNullableString(initialData.cityId),
                regionText: toNullableString(initialData.regionText ?? initialData.region) ?? "",
                cityText: toNullableString(initialData.cityText ?? initialData.city) ?? "",
                address: toNullableString(initialData.address) ?? "",
                latitude: toNullableDecimal(initialData.latitude),
                longitude: toNullableDecimal(initialData.longitude),
                capacity: toNullableInt(initialData.capacity),
                description: toNullableString(initialData.description) ?? ""
              }
            }
          }
        : {}),
      ...(normalizedType === "person"
        ? {
            person: {
              create: {
                personTypeNote: toNullableString(initialData.personTypeNote),
                gender: toNullableString(initialData.gender),
                birthDate: parseDateForCreate(initialData.birthDate, "birthDate"),
                deathDate: parseDateForCreate(initialData.deathDate, "deathDate"),
                birthCityEntityId: toNullableString(initialData.birthCityId),
                bio: toNullableString(initialData.bio) ?? "",
                isLiving:
                  typeof initialData.isLiving === "boolean"
                    ? initialData.isLiving
                    : parseDateForCreate(initialData.deathDate, "deathDate")
                      ? false
                      : null,
                identities: {
                  create: toPersonIdentities(toObjectArray(initialData.personIdentities))
                },
                troupeMemberships: {
                  create: toTroupeMemberships(toObjectArray(initialData.troupeMemberships))
                }
              }
            }
          }
        : {}),
      ...(normalizedType === "article"
        ? {
            article: {
              create: {
                articleType: (toNullableString(initialData.articleType) as ArticleType | null) ?? ArticleType.term,
                abstract: toNullableString(initialData.abstract) ?? excerptText(bodyMarkdown),
                difficultyLevel: toNullableString(initialData.difficultyLevel),
                bodySourceType: toNullableString(initialData.bodySourceType)
              }
            }
          }
        : {}),
      ...(normalizedType === "role"
        ? {
            roleRecord: {
              create: {
                workEntityId: toNullableString(initialData.workEntityId),
                roleCategory: toNullableString(initialData.roleCategory),
                description: toNullableString(initialData.description) ?? bodyMarkdown
              }
            }
          }
        : {}),
      ...(normalizedType === "work"
        ? {
            work: {
              create: {
                workType: workType ?? WorkType.full_play,
                parentWorkId: input.parentWorkId ?? null,
                originalAuthor: toNullableString(initialData.originalAuthor),
                dynastyPeriod: toNullableString(initialData.dynastyPeriod),
                genreNote: toNullableString(initialData.genreNote),
                synopsis: toNullableString(initialData.synopsis) ?? excerptText(bodyMarkdown),
                plot: toNullableString(initialData.plot) ?? "",
                durationMinutes: toNullableInt(initialData.durationMinutes),
                firstKnownDate: toNullableString(initialData.firstKnownDate)
              }
            }
          }
        : {}),
      ...(normalizedType === "event"
        ? {
            event: {
              create: {
                eventType: initialEventType,
                businessStatus: initialEventStatus as EventStatus,
                startAt: initialStartAt,
                endAt: typeof initialData.endAt === "string" ? parseDateForCreate(initialData.endAt, "endAt") : null,
                cityEntityId: typeof initialData.cityId === "string" && initialData.cityId.length > 0 ? initialData.cityId : null,
                venueEntityId:
                  typeof initialData.venueEntityId === "string" && initialData.venueEntityId.length > 0 ? initialData.venueEntityId : null,
                ticketUrl: typeof initialData.ticketUrl === "string" && initialData.ticketUrl.length > 0 ? initialData.ticketUrl : null,
                durationText:
                  typeof initialData.duration === "string" && initialData.duration.length > 0
                    ? initialData.duration
                    : typeof initialData.durationText === "string" && initialData.durationText.length > 0
                      ? initialData.durationText
                      : null,
                ticketStatus:
                  typeof initialData.ticketStatus === "string" && initialData.ticketStatus.length > 0 ? initialData.ticketStatus : null,
                noteText: typeof initialData.noteText === "string" && initialData.noteText.length > 0 ? initialData.noteText : null,
                posterImageId: toNullableString(initialData.posterImageId)
              }
            }
          }
        : {})
    },
    select: {
      id: true,
      slug: true,
      title: true
    }
  });

  await prisma.$transaction(async (tx) => {
    await applyStructuredProposal(tx, normalizedType, entity.id, initialData);
    if (Array.isArray(initialData.representativeWorkIds)) {
      await replaceEntityRelations(tx, entity.id, "rep_work", toStringArray(initialData.representativeWorkIds));
    }
    if (Array.isArray(initialData.representativeExcerptIds)) {
      await replaceEntityRelations(tx, entity.id, "rep_excerpt", toStringArray(initialData.representativeExcerptIds));
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: createdById,
      actionType: "entity.quick_create",
      targetType: normalizedType,
      targetId: entity.id,
      payloadJson: {
        title: finalTitle,
        workType: workType ?? null,
        parentWorkId: input.parentWorkId ?? null
      }
    }
  });

  await searchIndex.rebuildEntity(entity.id);
  return entity;
}

/**
 * 按类型和标题查找已有实体，用于快速创建前的重复判断。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `entityType`: 实体类型。
 * - `title`: 完整标题。
 *
 * 输出：
 * - 返回首个匹配实体的轻量信息；不存在时返回 `null`。
 */
export async function findEntityByTypeAndTitle(prisma: PrismaService, entityType: EntityType, title: string) {
  return prisma.entity.findFirst({
    where: {
      entityType,
      title
    },
    select: {
      id: true,
      slug: true,
      title: true
    }
  });
}

/**
 * 删除指定实体及其级联数据，仅用于管理员操作。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `entityId`: 待删除实体 ID。
 * - `actorId`: 执行删除的管理员 ID。
 *
 * 输出：
 * - 返回被删除实体的 `{ id, slug, title, entityType }`。
 */
export async function deleteEntity(prisma: PrismaService, entityId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.findUnique({
      where: { id: entityId },
      select: { id: true, slug: true, title: true, entityType: true }
    });
    if (!entity) {
      throw new NotFoundException(`Entity ${entityId} not found`);
    }

    const deleted = await tx.entity.delete({
      where: { id: entityId },
      select: { id: true, slug: true, title: true, entityType: true }
    });

    await tx.auditLog.create({
      data: {
        actorId,
        actionType: "entity.delete",
        targetType: deleted.entityType,
        targetId: deleted.id,
        payloadJson: {
          slug: deleted.slug,
          title: deleted.title
        }
      }
    });

    return deleted;
  });
}
