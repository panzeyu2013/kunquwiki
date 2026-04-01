import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ArticleType, EntityType, EventStatus, EventType, Prisma, PrismaClient, ProposalStatus, PublishStatus, TroupeType, WorkType } from "@prisma/client";
import { generateUniqueSlug, replaceEntityRelations } from "./content.helpers";
import { applyStructuredProposal } from "./content.mutations";
import { entityInclude } from "./content.types";
import {
  excerptText,
  normalizeSlugInput,
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

/**
 * 为现有实体创建编辑提案。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `slug`: 被编辑实体的 slug。
 * - `proposerId`: 提案人用户 ID。
 * - `payload`: 提案类型、编辑摘要和结构化内容。
 *
 * 输出：
 * - 返回新建的 `EditProposal` 记录。
 *
 * 控制逻辑：
 * 1. 先规范化 slug，并确认实体真实存在。
 * 2. 再按 `Entity.entityType` 校验所有关系字段和素材引用。
 * 3. 若未填写编辑摘要，则生成默认签名摘要。
 * 4. 提案创建成功后同步写入审计日志。
 *
 * 所需组件：
 * - `validateRelationshipPayload`
 * - `buildDefaultEditSummary`
 */
export async function createProposal(
  prisma: PrismaService,
  slug: string,
  proposerId: string,
  payload: { proposalType: string; editSummary: string; payload: Record<string, unknown> }
) {
  const normalizedSlug = normalizeSlugInput(slug);
  const entity = await prisma.entity.findUnique({ where: { slug: normalizedSlug } });
  if (!entity) {
    throw new NotFoundException(`Entity ${normalizedSlug} not found`);
  }

  const normalizedPayload = await validateRelationshipPayload(prisma, entity.entityType, payload.payload);
  const normalizedEditSummary = await buildDefaultEditSummary(prisma, proposerId, payload.editSummary);

  const proposal = await prisma.editProposal.create({
    data: {
      entityId: entity.id,
      targetEntityType: entity.entityType,
      proposerId,
      proposalType: payload.proposalType,
      payloadJson: {
        editSummary: normalizedEditSummary,
        ...normalizedPayload
      } as Prisma.InputJsonValue
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: proposerId,
      actionType: "proposal.create",
      targetType: entity.entityType,
      targetId: entity.id,
      payloadJson: normalizedPayload as Prisma.InputJsonValue
    }
  });

  return proposal;
}

/**
 * 为新建实体创建提案（不直接落库实体）。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `proposerId`: 提案人用户 ID。
 * - `payload`: 创建提案类型、编辑摘要、目标实体类型及结构化内容。
 *
 * 输出：
 * - 返回新建的 `EditProposal` 记录（entityId 为空）。
 */
export async function createEntityProposal(
  prisma: PrismaService,
  proposerId: string,
  payload: { proposalType: string; editSummary: string; entityType: EntityType; payload: Record<string, unknown> }
) {
  const normalizedPayload = await validateRelationshipPayload(prisma, payload.entityType, payload.payload);
  const normalizedEditSummary = await buildDefaultEditSummary(prisma, proposerId, payload.editSummary);

  const proposal = await prisma.editProposal.create({
    data: {
      entityId: null,
      targetEntityType: payload.entityType,
      proposerId,
      proposalType: payload.proposalType,
      payloadJson: {
        editSummary: normalizedEditSummary,
        ...normalizedPayload
      } as Prisma.InputJsonValue
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: proposerId,
      actionType: "proposal.create_entity",
      targetType: payload.entityType,
      targetId: proposal.id,
      payloadJson: normalizedPayload as Prisma.InputJsonValue
    }
  });

  return proposal;
}

/**
 * 审核提案，并在通过时把正文和结构化字段正式写回数据库。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `searchIndex`: 搜索索引重建器。
 * - `id`: 提案 ID。
 * - `reviewerId`: 审核人用户 ID。
 * - `decision`: `"approved"` 或 `"rejected"`。
 * - `reviewComment`: 可选审核意见。
 *
 * 输出：
 * - 返回更新后的提案记录。
 *
 * 控制逻辑：
 * 1. 先读取提案及目标实体，不存在则直接报错。
 * 2. 审核动作整体运行在事务中，保证提案状态、实体写回、revision、积分和审计日志一致。
 * 3. 审核通过时，正文统一写回 `EntityContent.bodyMarkdown`，结构化字段交给 `applyStructuredProposal`。
 * 4. revision 正文快照与当前正文口径保持一致，最后重建搜索索引。
 *
 * 所需组件：
 * - `validateRelationshipPayload`
 * - `ensureStoredEntityTitle`
 * - `applyStructuredProposal`
 * - `searchIndex.rebuildEntity`
 */
export async function reviewProposal(
  prisma: PrismaService,
  searchIndex: SearchIndexer,
  id: string,
  reviewerId: string,
  decision: "approved" | "rejected",
  reviewComment?: string
) {
  const proposal = await prisma.editProposal.findUnique({
    where: { id },
    include: {
      entity: {
        include: entityInclude
      }
    }
  });

  if (!proposal) {
    throw new NotFoundException(`Proposal ${id} not found`);
  }

  return prisma.$transaction(async (tx) => {
    const updatedProposal = await tx.editProposal.update({
      where: { id },
      data: {
        status: decision === "approved" ? ProposalStatus.approved : ProposalStatus.rejected,
        reviewerId,
        reviewedAt: new Date(),
        reviewComment
      }
    });

    if (decision === "approved") {
      if (proposal.entityId && proposal.entity) {
        const payload = await validateRelationshipPayload(tx, proposal.entity.entityType, proposal.payloadJson as Record<string, unknown>);
        const currentContent = await tx.entityContent.findUnique({
          where: { entityId: proposal.entityId }
        });

        const nextRevisionNo =
          ((await tx.entityRevision.aggregate({
            where: { entityId: proposal.entityId },
            _max: { revisionNo: true }
          }))._max.revisionNo ?? 0) + 1;

        const nextTitle =
          typeof payload.title === "string"
            ? await ensureStoredEntityTitle(tx, proposal.entity.entityType, payload.title, proposal.entityId)
            : proposal.entity.title;
        const nextSlug = proposal.entity.slug;

        await tx.entity.update({
          where: { id: proposal.entityId },
          data: {
            slug: nextSlug,
            title: nextTitle,
            ...(typeof payload.coverImageId === "string" || payload.coverImageId === null
              ? { coverImageId: toNullableString(payload.coverImageId) }
              : {}),
            updatedById: reviewerId,
            status: PublishStatus.published
          }
        });

        if (proposal.entity.entityType === "event") {
          await tx.event.update({
            where: { entityId: proposal.entityId },
            data: {
              lastVerifiedAt: new Date()
            }
          });
        }

        if (typeof payload.bodyMarkdown === "string") {
          await tx.entityContent.upsert({
            where: { entityId: proposal.entityId },
            update: {
              bodyMarkdown: payload.bodyMarkdown
            },
            create: {
              entityId: proposal.entityId,
              bodyMarkdown: payload.bodyMarkdown
            }
          });
        } else if (!currentContent) {
          await tx.entityContent.create({
            data: {
              entityId: proposal.entityId,
              bodyMarkdown: "待补充"
            }
          });
        }

        await applyStructuredProposal(tx, proposal.entity.entityType, proposal.entityId, payload);

        await tx.entityRevision.create({
          data: {
            entityId: proposal.entityId,
            revisionNo: nextRevisionNo,
            title: nextTitle,
            bodyMarkdown:
              typeof payload.bodyMarkdown === "string"
                ? payload.bodyMarkdown
                : (await tx.entityContent.findUnique({ where: { entityId: proposal.entityId }, select: { bodyMarkdown: true } }))?.bodyMarkdown ??
                  currentContent?.bodyMarkdown,
            structuredDataJson: payload as Prisma.InputJsonValue,
            editSummary: typeof payload.editSummary === "string" ? payload.editSummary : "审核通过并写回条目",
            reviewStatus: "approved",
            editorId: proposal.proposerId,
            reviewerId,
            reviewedAt: new Date()
          }
        });

        await tx.user.update({
          where: { id: proposal.proposerId },
          data: {
            reputation: { increment: 1 }
          }
        });

        await searchIndex.rebuildEntity(proposal.entityId, tx);
      } else {
        const payload = proposal.payloadJson as Record<string, unknown>;
        const entityType = proposal.targetEntityType ?? (typeof payload.entityType === "string" ? (payload.entityType as EntityType) : null);
        if (!entityType) {
          throw new BadRequestException("创建提案缺少 entityType");
        }

        const createdEntity = await createEntityFromProposal(tx, searchIndex, {
          entityType,
          proposerId: proposal.proposerId,
          reviewerId,
          proposalId: proposal.id,
          payload
        });

        await tx.editProposal.update({
          where: { id: proposal.id },
          data: {
            entityId: createdEntity.id
          }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: reviewerId,
        actionType: `proposal.${decision}`,
        targetType: proposal.entity?.entityType ?? proposal.targetEntityType ?? "unknown",
        targetId: proposal.entityId ?? proposal.id,
        payloadJson: {
          proposalId: proposal.id,
          reviewComment
        }
      }
    });

    return updatedProposal;
  });
}

async function createEntityFromProposal(
  tx: Prisma.TransactionClient,
  searchIndex: SearchIndexer,
  input: {
    entityType: EntityType;
    proposerId: string;
    reviewerId: string;
    proposalId: string;
    payload: Record<string, unknown>;
  }
) {
  const normalizedPayload = await validateRelationshipPayload(tx, input.entityType, input.payload);

  if (typeof normalizedPayload.title !== "string" || normalizedPayload.title.trim().length === 0) {
    throw new BadRequestException("title is required");
  }

  const trimmedTitle = normalizedPayload.title.trim();
  let finalTitle = trimmedTitle;
  let workType = normalizedPayload.workType as WorkType | undefined;

  if (input.entityType === "work" && normalizedPayload.workType === WorkType.excerpt) {
    if (!normalizedPayload.parentWorkId || typeof normalizedPayload.parentWorkId !== "string") {
      throw new NotFoundException("折子戏需要先选择所属剧目");
    }
    const parent = await ensureEntityReference(tx, normalizedPayload.parentWorkId, EntityType.work, "parentWorkId");
    finalTitle = trimmedTitle.startsWith(`${parent.title}·`) ? trimmedTitle : `${parent.title}·${trimmedTitle}`;
    workType = WorkType.excerpt;
  }

  if (input.entityType !== "event") {
    await ensureStoredEntityTitle(tx, input.entityType, finalTitle);
  }

  const explicitBodyMarkdown =
    Object.prototype.hasOwnProperty.call(normalizedPayload, "bodyMarkdown") && typeof normalizedPayload.bodyMarkdown === "string"
      ? normalizedPayload.bodyMarkdown
      : null;
  const bodyMarkdown =
    explicitBodyMarkdown ??
    (input.entityType !== "event" && typeof normalizedPayload.bodyMarkdown === "string" && normalizedPayload.bodyMarkdown.trim().length > 0
      ? normalizedPayload.bodyMarkdown
      : "待补充");
  const parsedStartAt = typeof normalizedPayload.startAt === "string" ? parseDateForCreate(normalizedPayload.startAt, "startAt", true) : null;
  const initialStartAt = parsedStartAt ?? new Date();
  const initialEventType =
    typeof normalizedPayload.eventType === "string" && normalizedPayload.eventType.length > 0
      ? (normalizedPayload.eventType as EventType)
      : EventType.performance;
  const initialEventStatus =
    typeof normalizedPayload.businessStatus === "string" && normalizedPayload.businessStatus.length > 0
      ? normalizedPayload.businessStatus
      : EventStatus.scheduled;
  const initialTroupeIds = Array.isArray(normalizedPayload.troupeIds)
    ? toStringArray(normalizedPayload.troupeIds)
    : typeof normalizedPayload.troupeId === "string" && normalizedPayload.troupeId.length > 0
      ? [normalizedPayload.troupeId]
      : [];
  const slug =
    input.entityType === "event"
      ? await generateUniqueSlug(tx, {
          format: "event",
          startAt: initialStartAt,
          troupeEntityId: initialTroupeIds[0] ?? null,
          title: finalTitle
        })
      : await generateUniqueSlug(tx, { format: "generic", title: finalTitle });

  const entity = await tx.entity.create({
    data: {
      entityType: input.entityType,
      slug,
      title: finalTitle,
      status: PublishStatus.published,
      visibility: "public",
      coverImageId: toNullableString(normalizedPayload.coverImageId),
      createdById: input.proposerId,
      updatedById: input.reviewerId,
      content: {
        create: {
          bodyMarkdown
        }
      },
      ...(input.entityType === "city"
        ? {
            city: {
              create: {
                province: toNullableString(normalizedPayload.province) ?? "待补充"
              }
            }
          }
        : {}),
      ...(input.entityType === "troupe"
        ? {
            troupe: {
              create: {
                troupeType: (toNullableString(normalizedPayload.troupeType) as TroupeType | null) ?? TroupeType.troupe,
                foundedDate: parseDateForCreate(normalizedPayload.foundedDate, "foundedDate"),
                dissolvedDate: parseDateForCreate(normalizedPayload.dissolvedDate, "dissolvedDate"),
                cityEntityId: toNullableString(normalizedPayload.cityId),
                cityText: toNullableString(normalizedPayload.cityText ?? normalizedPayload.city) ?? "",
                regionText: toNullableString(normalizedPayload.regionText ?? normalizedPayload.region) ?? "",
                description: toNullableString(normalizedPayload.description) ?? "",
                officialWebsite: toNullableString(normalizedPayload.officialWebsite)
              }
            }
          }
        : {}),
      ...(input.entityType === "venue"
        ? {
            venue: {
              create: {
                venueType: toNullableString(normalizedPayload.venueType) ?? "theater",
                countryText: toNullableString(normalizedPayload.countryText ?? normalizedPayload.country) ?? "中国",
                cityEntityId: toNullableString(normalizedPayload.cityId),
                regionText: toNullableString(normalizedPayload.regionText ?? normalizedPayload.region) ?? "",
                cityText: toNullableString(normalizedPayload.cityText ?? normalizedPayload.city) ?? "",
                address: toNullableString(normalizedPayload.address) ?? "",
                latitude: toNullableDecimal(normalizedPayload.latitude),
                longitude: toNullableDecimal(normalizedPayload.longitude),
                capacity: toNullableInt(normalizedPayload.capacity),
                description: toNullableString(normalizedPayload.description) ?? ""
              }
            }
          }
        : {}),
      ...(input.entityType === "person"
        ? {
            person: {
              create: {
                personTypeNote: toNullableString(normalizedPayload.personTypeNote),
                gender: toNullableString(normalizedPayload.gender),
                birthDate: parseDateForCreate(normalizedPayload.birthDate, "birthDate"),
                deathDate: parseDateForCreate(normalizedPayload.deathDate, "deathDate"),
                birthCityEntityId: toNullableString(normalizedPayload.birthCityId),
                bio: toNullableString(normalizedPayload.bio) ?? "",
                isLiving:
                  typeof normalizedPayload.isLiving === "boolean"
                    ? normalizedPayload.isLiving
                    : parseDateForCreate(normalizedPayload.deathDate, "deathDate")
                      ? false
                      : null,
                identities: {
                  create: toPersonIdentities(toObjectArray(normalizedPayload.personIdentities))
                },
                troupeMemberships: {
                  create: toTroupeMemberships(toObjectArray(normalizedPayload.troupeMemberships))
                }
              }
            }
          }
        : {}),
      ...(input.entityType === "article"
        ? {
            article: {
              create: {
                articleType: (toNullableString(normalizedPayload.articleType) as ArticleType | null) ?? ArticleType.term,
                abstract: toNullableString(normalizedPayload.abstract) ?? excerptText(bodyMarkdown),
                difficultyLevel: toNullableString(normalizedPayload.difficultyLevel),
                bodySourceType: toNullableString(normalizedPayload.bodySourceType)
              }
            }
          }
        : {}),
      ...(input.entityType === "role"
        ? {
            roleRecord: {
              create: {
                workEntityId: toNullableString(normalizedPayload.workEntityId),
                roleCategory: toNullableString(normalizedPayload.roleCategory),
                description: toNullableString(normalizedPayload.description) ?? bodyMarkdown
              }
            }
          }
        : {}),
      ...(input.entityType === "work"
        ? {
            work: {
              create: {
                workType: workType ?? WorkType.full_play,
                parentWorkId: typeof normalizedPayload.parentWorkId === "string" ? normalizedPayload.parentWorkId : null,
                originalAuthor: toNullableString(normalizedPayload.originalAuthor),
                dynastyPeriod: toNullableString(normalizedPayload.dynastyPeriod),
                genreNote: toNullableString(normalizedPayload.genreNote),
                synopsis: toNullableString(normalizedPayload.synopsis) ?? excerptText(bodyMarkdown),
                plot: toNullableString(normalizedPayload.plot) ?? "",
                durationMinutes: toNullableInt(normalizedPayload.durationMinutes),
                firstKnownDate: toNullableString(normalizedPayload.firstKnownDate)
              }
            }
          }
        : {}),
      ...(input.entityType === "event"
        ? {
            event: {
              create: {
                eventType: initialEventType,
                businessStatus: initialEventStatus as EventStatus,
                startAt: initialStartAt,
                endAt: typeof normalizedPayload.endAt === "string" ? parseDateForCreate(normalizedPayload.endAt, "endAt") : null,
                cityEntityId: typeof normalizedPayload.cityId === "string" && normalizedPayload.cityId.length > 0 ? normalizedPayload.cityId : null,
                venueEntityId:
                  typeof normalizedPayload.venueEntityId === "string" && normalizedPayload.venueEntityId.length > 0
                    ? normalizedPayload.venueEntityId
                    : null,
                ticketUrl: typeof normalizedPayload.ticketUrl === "string" && normalizedPayload.ticketUrl.length > 0 ? normalizedPayload.ticketUrl : null,
                durationText:
                  typeof normalizedPayload.duration === "string" && normalizedPayload.duration.length > 0
                    ? normalizedPayload.duration
                    : typeof normalizedPayload.durationText === "string" && normalizedPayload.durationText.length > 0
                      ? normalizedPayload.durationText
                      : null,
                ticketStatus:
                  typeof normalizedPayload.ticketStatus === "string" && normalizedPayload.ticketStatus.length > 0
                    ? normalizedPayload.ticketStatus
                    : null,
                noteText: typeof normalizedPayload.noteText === "string" && normalizedPayload.noteText.length > 0 ? normalizedPayload.noteText : null,
                posterImageId: toNullableString(normalizedPayload.posterImageId),
                lastVerifiedAt: new Date()
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

  await applyStructuredProposal(tx, input.entityType, entity.id, normalizedPayload);
  if (Array.isArray(normalizedPayload.representativeWorkIds)) {
    await replaceEntityRelations(tx, entity.id, "rep_work", toStringArray(normalizedPayload.representativeWorkIds));
  }
  if (Array.isArray(normalizedPayload.representativeExcerptIds)) {
    await replaceEntityRelations(tx, entity.id, "rep_excerpt", toStringArray(normalizedPayload.representativeExcerptIds));
  }

  await tx.entityRevision.create({
    data: {
      entityId: entity.id,
      revisionNo: 1,
      title: entity.title,
      bodyMarkdown:
        typeof normalizedPayload.bodyMarkdown === "string"
          ? normalizedPayload.bodyMarkdown
          : (await tx.entityContent.findUnique({ where: { entityId: entity.id }, select: { bodyMarkdown: true } }))?.bodyMarkdown ?? "待补充",
      structuredDataJson: normalizedPayload as Prisma.InputJsonValue,
      editSummary: typeof normalizedPayload.editSummary === "string" ? normalizedPayload.editSummary : "审核通过并创建条目",
      reviewStatus: "approved",
      editorId: input.proposerId,
      reviewerId: input.reviewerId,
      reviewedAt: new Date()
    }
  });

  await tx.user.update({
    where: { id: input.proposerId },
    data: {
      reputation: { increment: 1 }
    }
  });

  await tx.auditLog.create({
    data: {
      actorId: input.reviewerId,
      actionType: "entity.create_from_proposal",
      targetType: input.entityType,
      targetId: entity.id,
      payloadJson: {
        proposalId: input.proposalId,
        proposerId: input.proposerId
      }
    }
  });

  await searchIndex.rebuildEntity(entity.id, tx);

  return entity;
}

/**
 * 确保待写回标题在同类型实体内唯一。
 *
 * 输入：
 * - `db`: Prisma client 或事务 client。
 * - `entityType`: 当前实体类型。
 * - `baseTitle`: 候选标题。
 * - `excludeEntityId`: 编辑现有实体时需要排除的自身 ID。
 *
 * 输出：
 * - 校验通过时返回原始标题；冲突时抛出异常。
 */
async function ensureStoredEntityTitle(
  db: Prisma.TransactionClient | PrismaClient,
  entityType: EntityType,
  baseTitle: string,
  excludeEntityId?: string
) {
  const existing = await db.entity.findFirst({
    where: {
      entityType,
      title: baseTitle,
      ...(excludeEntityId ? { id: { not: excludeEntityId } } : {})
    },
    select: { id: true, title: true }
  });

  if (existing) {
    throw new ConflictException(`已存在同名${entityType === "work" ? "剧目" : "条目"}，请修改标题后再提交`);
  }

  return baseTitle;
}

/**
 * 为提案生成默认编辑摘要。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `proposerId`: 提案人 ID。
 * - `editSummary`: 前端显式填写的摘要，可选。
 *
 * 输出：
 * - 返回最终可入库的摘要文本。
 *
 * 控制逻辑：
 * - 用户显式填写时原样使用。
 * - 未填写时根据用户显示名/用户名拼出带 UTC 时间戳的默认摘要。
 */
async function buildDefaultEditSummary(prisma: PrismaService, proposerId: string, editSummary?: string) {
  if (typeof editSummary === "string" && editSummary.trim().length > 0) {
    return editSummary.trim();
  }

  const user = await prisma.user.findUnique({
    where: { id: proposerId },
    select: { displayName: true, username: true }
  });
  const signature = user?.displayName?.trim() || user?.username?.trim() || proposerId;
  const timestamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  return `${signature} ${timestamp}`;
}
