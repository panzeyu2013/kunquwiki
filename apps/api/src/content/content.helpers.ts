import { EntityType, Prisma, PrismaClient } from "@prisma/client";
import { OptionItem } from "./content.types";
import { PrismaService } from "../prisma.service";

/**
 * 读取指定类型的实体选项列表，供后台表单下拉框复用。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `entityType`: 候选实体类型。
 * - `excludeEntityId`: 可选排除项。
 * - `extraWhere`: 附加 Prisma 过滤条件。
 *
 * 输出：
 * - 返回 `{ id, slug, title }[]` 轻量选项数组。
 */
export async function listEntityOptions(
  prisma: PrismaService,
  entityType: EntityType,
  excludeEntityId?: string,
  extraWhere?: Prisma.EntityWhereInput
) {
  return prisma.entity.findMany({
    where: {
      entityType,
      ...(excludeEntityId ? { id: { not: excludeEntityId } } : {}),
      ...extraWhere
    },
    orderBy: { title: "asc" },
    select: {
      id: true,
      slug: true,
      title: true
    }
  }) as Promise<OptionItem[]>;
}

/**
 * 用“整组替换”的方式维护实体关系表。
 *
 * 输入：
 * - `tx`: Prisma 事务 client。
 * - `fromEntityId`: 关系起点实体。
 * - `relationType`: 关系类型标记。
 * - `toEntityIds`: 目标实体 ID 列表。
 *
 * 输出：
 * - 无显式返回值；关系表会被替换成新的有序集合。
 */
export async function replaceEntityRelations(
  tx: Prisma.TransactionClient,
  fromEntityId: string,
  relationType: string,
  toEntityIds: string[]
) {
  await tx.entityRelation.deleteMany({
    where: {
      fromEntityId,
      relationType
    }
  });
  if (toEntityIds.length > 0) {
    await tx.entityRelation.createMany({
      data: toEntityIds.map((toEntityId, index) => ({
        fromEntityId,
        toEntityId,
        relationType,
        sortOrder: index
      }))
    });
  }
}

/**
 * 根据标题生成全站唯一 slug。
 *
 * 输入：
 * - `db`: Prisma client 或 service。
 * - `title`: 原始实体标题。
 *
 * 输出：
 * - 返回可安全写入数据库的唯一 slug。
 */
type UniqueSlugInput =
  | { format: "generic"; title: string }
  | { format: "event"; title: string; startAt: Date | null; troupeEntityId: string | null };

// Event演出是一个特殊例子，因为其他的slug=entity title（比如牡丹亭）
// 但是为了保证演出的唯一性使用日期+院团+标题的格式会更好

/**
 * 生成全站唯一 slug（通用与活动两种格式）。
 *
 * 输入：
 * - `db`: Prisma client 或 service。
 * - `input`: slug 生成输入，支持 `generic` / `event` 两种格式。
 * - `excludeEntityId`: 更新时需要排除的自身实体 ID。
 *
 * 输出：
 * - `generic`: kebab-case，冲突时追加 `-2/-3`。
 * - `event`: 日期_院团_标题（snake_case），冲突时追加 `_2/_3`。
 */
export async function generateUniqueSlug(
  db: PrismaService | PrismaClient | Prisma.TransactionClient,
  input: UniqueSlugInput,
  excludeEntityId?: string
) {
  if (input.format === "event") {
    const dateLabel = input.startAt ? input.startAt.toISOString().slice(0, 10).replace(/-/g, "_") : "undated";
    const troupeTitle = input.troupeEntityId
      ? (
          await db.entity.findUnique({
            where: { id: input.troupeEntityId },
            select: { title: true }
          })
        )?.title ?? "unknown_troupe"
      : "unknown_troupe";

    const base = [dateLabel, troupeTitle, input.title]
      .map((item) =>
        item
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^\p{Letter}\p{Number}_]+/gu, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
      )
      .filter(Boolean)
      .join("_");

    let candidate = base || "event";
    let counter = 2;
    while (
      await db.entity.findFirst({
        where: {
          slug: candidate,
          ...(excludeEntityId ? { id: { not: excludeEntityId } } : {})
        },
        select: { id: true }
      })
    ) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }
    return candidate;
  }

  const base =
    input.title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "entity";

  let candidate = base;
  let counter = 2;
  while (await db.entity.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}
