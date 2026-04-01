import { ConflictException, NotFoundException } from "@nestjs/common";
import { EntityType, Prisma, PrismaClient, ProposalStatus, PublishStatus } from "@prisma/client";
import { applyStructuredProposal } from "./content.mutations";
import { entityInclude } from "./content.types";
import { normalizeSlugInput, toNullableString } from "./content.utils";
import { validateRelationshipPayload } from "./content.validation";
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
    }

    await tx.auditLog.create({
      data: {
        actorId: reviewerId,
        actionType: `proposal.${decision}`,
        targetType: proposal.entity.entityType,
        targetId: proposal.entityId,
        payloadJson: {
          proposalId: proposal.id,
          reviewComment
        }
      }
    });

    return updatedProposal;
  });
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
