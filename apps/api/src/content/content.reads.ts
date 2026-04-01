import { Prisma, PrismaClient } from "@prisma/client";
import { FullEntity } from "./content.types";

/**
 * 统计剧目被节目单引用的次数，并返回按次数倒序排列的聚合结果。
 *
 * 输入：
 * - `prisma`: 读取 `Entity` 表所需的 Prisma client。
 * - `workAggregation`: 由 `groupBy` 得到的剧目引用统计结果。
 *
 * 输出：
 * - 返回 `{ title, count }[]`，用于首页/统计页展示热门剧目。
 *
 * 控制逻辑：
 * 1. 先过滤掉空的 `workEntityId`。
 * 2. 再批量补齐剧目标题，避免展示裸 ID。
 * 3. 最后按引用次数倒序排序。
 */
export async function buildTopWorks(
  prisma: {
    entity: {
      findMany(args: {
        where: { id: { in: string[] } };
        select: { id: true; title: true };
      }): Promise<Array<{ id: string; title: string }>>;
    };
  },
  workAggregation: Array<{ workEntityId: string | null; _count: number }>
) {
  const countsById = new Map(
    workAggregation
      .filter((item): item is { workEntityId: string; _count: number } => Boolean(item.workEntityId))
      .map((item) => [item.workEntityId, item._count])
  );

  if (countsById.size === 0) {
    return [];
  }

  const works = await prisma.entity.findMany({
    where: { id: { in: [...countsById.keys()] } },
    select: { id: true, title: true }
  });

  return works
    .map((work) => ({
      title: work.title || "未命名剧目",
      count: countsById.get(work.id) ?? 0
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 收集条目详情页右侧/下方的“相关条目”候选集。
 *
 * 输入：
 * - `prisma`: 负责读取各子表和 Entity 的 Prisma client。
 * - `entity`: 已包含主要关联的完整实体对象。
 *
 * 输出：
 * - 返回最多 6 个相关条目，每项包含 `id/slug/title/entityType`。
 *
 * 控制逻辑：
 * - 根据 `entity.entityType` 分支读取不同的关联来源。
 * - 使用 `collectEntityCandidate` 去重，避免同一条目重复出现。
 * - 这里只负责聚合导航关系，不做正文或结构化字段映射。
 */
export async function getRelatedEntities(
  prisma: Prisma.TransactionClient | PrismaClient,
  entity: FullEntity
) {
  const candidates = new Map<string, { id: string; slug: string; title: string; entityType: string }>();

  if (entity.entityType === "event") {
    if (entity.event?.cityEntityId) {
      await collectEntityCandidate(prisma, entity.event.cityEntityId, candidates);
    }
    for (const troupeLink of entity.event?.troupes ?? []) {
      await collectEntityCandidate(prisma, troupeLink.troupeEntityId, candidates);
    }
    for (const item of entity.event?.programItems ?? []) {
      if (item.workEntityId) {
        await collectEntityCandidate(prisma, item.workEntityId, candidates);
      }
      for (const cast of item.casts ?? []) {
        if (cast.roleEntityId) {
          await collectEntityCandidate(prisma, cast.roleEntityId, candidates);
        }
        if (cast.personEntityId) {
          await collectEntityCandidate(prisma, cast.personEntityId, candidates);
        }
      }
    }
    if (entity.event?.venueEntityId) {
      await collectEntityCandidate(prisma, entity.event.venueEntityId, candidates);
    }
  }

  if (entity.entityType === "work") {
    if (entity.work?.parentWorkId) {
      await collectEntityCandidate(prisma, entity.work.parentWorkId, candidates);
    }
    const childWorks = await prisma.work.findMany({
      where: { parentWorkId: entity.id },
      take: 5
    });
    for (const child of childWorks) {
      await collectEntityCandidate(prisma, child.entityId, candidates);
    }
    const relatedEvents = await prisma.eventProgramItem.findMany({
      where: { workEntityId: entity.id },
      take: 5,
      orderBy: { sequenceNo: "asc" }
    });
    for (const item of relatedEvents) {
      await collectEntityCandidate(prisma, item.eventEntityId, candidates);
    }
  }

  if (entity.entityType === "person") {
    if (entity.person?.birthCityEntityId) {
      await collectEntityCandidate(prisma, entity.person.birthCityEntityId, candidates);
    }
    for (const membership of entity.person?.troupeMemberships ?? []) {
      await collectEntityCandidate(prisma, membership.troupeEntityId, candidates);
    }
    for (const relation of entity.outgoingRelations.filter((item) => ["rep_work", "rep_excerpt"].includes(item.relationType))) {
      await collectEntityCandidate(prisma, relation.toEntityId, candidates);
    }
    const relatedEvents = await prisma.performanceCast.findMany({
      where: { personEntityId: entity.id },
      take: 5,
      include: {
        programItem: true
      }
    });
    for (const cast of relatedEvents) {
      await collectEntityCandidate(prisma, cast.programItem.eventEntityId, candidates);
    }
    const participantEvents = await prisma.eventParticipant.findMany({
      where: { personEntityId: entity.id },
      take: 5
    });
    for (const participant of participantEvents) {
      await collectEntityCandidate(prisma, participant.eventEntityId, candidates);
    }
  }

  if (entity.entityType === "troupe") {
    if (entity.troupe?.cityEntityId) {
      await collectEntityCandidate(prisma, entity.troupe.cityEntityId, candidates);
    }
    const members = await prisma.personTroupeMembership.findMany({
      where: { troupeEntityId: entity.id },
      take: 5
    });
    for (const member of members) {
      await collectEntityCandidate(prisma, member.personEntityId, candidates);
    }
    const events = await prisma.eventTroupe.findMany({
      where: { troupeEntityId: entity.id },
      take: 5
    });
    for (const event of events) {
      await collectEntityCandidate(prisma, event.eventEntityId, candidates);
    }
  }

  if (entity.entityType === "venue") {
    if (entity.venue?.cityEntityId) {
      await collectEntityCandidate(prisma, entity.venue.cityEntityId, candidates);
    }
    const events = await prisma.event.findMany({
      where: { venueEntityId: entity.id },
      take: 5,
      orderBy: { startAt: "desc" }
    });
    for (const event of events) {
      await collectEntityCandidate(prisma, event.entityId, candidates);
    }
  }

  if (entity.entityType === "city") {
    const [venues, troupes] = await Promise.all([
      prisma.venue.findMany({ where: { cityEntityId: entity.id }, take: 5 }),
      prisma.troupe.findMany({ where: { cityEntityId: entity.id }, take: 5 })
    ]);
    for (const venue of venues) {
      await collectEntityCandidate(prisma, venue.entityId, candidates);
    }
    for (const troupe of troupes) {
      await collectEntityCandidate(prisma, troupe.entityId, candidates);
    }
  }

  return [...candidates.values()].slice(0, 6);
}

/**
 * 构造实体详情页中的“未来演出 / 过往演出”列表。
 *
 * 输入：
 * - `prisma`: 用于读取 Event 与其关联城市/场馆/剧团。
 * - `entity`: 当前详情页实体。
 * - `mode`: `"upcoming"` 或 `"past"`，决定时间筛选与排序方向。
 *
 * 输出：
 * - 返回可直接给前端展示的演出记录数组。
 *
 * 控制逻辑：
 * - 先按实体类型构造不同的事件查询条件。
 * - 再统一补齐城市、场馆、剧团展示文本。
 * - 如果该实体天然没有关联事件的查询方式，则直接返回空数组。
 */
export async function getEntityEventRecords(
  prisma: Prisma.TransactionClient | PrismaClient,
  entity: FullEntity,
  mode: "upcoming" | "past"
) {
  const now = new Date();
  const dateFilter = mode === "upcoming" ? { gte: now } : { lt: now };
  const orderBy = mode === "upcoming" ? ({ startAt: "asc" } as const) : ({ startAt: "desc" } as const);

  const where: Prisma.EventWhereInput =
    entity.entityType === "person"
      ? {
          startAt: dateFilter,
          OR: [
            { programItems: { some: { casts: { some: { personEntityId: entity.id } } } } },
            { participants: { some: { personEntityId: entity.id } } }
          ]
        }
      : entity.entityType === "troupe"
        ? {
            startAt: dateFilter,
            troupes: { some: { troupeEntityId: entity.id } }
          }
        : entity.entityType === "venue"
          ? { startAt: dateFilter, venueEntityId: entity.id }
          : entity.entityType === "city"
            ? { startAt: dateFilter, cityEntityId: entity.id }
            : entity.entityType === "work"
              ? { startAt: dateFilter, programItems: { some: { workEntityId: entity.id } } }
              : { startAt: dateFilter, entityId: "__none__" };

  if (where.entityId === "__none__") {
    return [];
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      entity: true,
      city: { include: { entity: true } },
      venue: { include: { entity: true, cityRecord: { include: { entity: true } } } },
      troupes: {
        include: { troupe: { include: { entity: true } } },
        orderBy: { sortOrder: "asc" }
      }
    },
    take: 10,
    orderBy
  });

  return events.map((event) => {
    const troupeNames = Array.from(
      new Set(
        event.troupes.map((link) => link.troupe?.entity.title ?? null).filter((name): name is string => Boolean(name))
      )
    );
    return {
      id: event.entityId,
      slug: event.entity.slug,
      title: event.entity.title,
      startAt: event.startAt.toISOString(),
      city: event.city?.entity.title ?? event.venue?.cityRecord?.entity.title ?? event.venue?.cityText ?? undefined,
      venue: event.venue?.entity.title ?? undefined,
      troupe: troupeNames.length > 0 ? troupeNames.join("、") : undefined
    };
  });
}

/**
 * 将单个 Entity 加入“相关条目”候选集合。
 *
 * 输入：
 * - `prisma`: 读取 Entity 基本信息所需的 Prisma client。
 * - `entityId`: 待加入候选集的条目 ID。
 * - `candidates`: 外部维护的去重 Map。
 *
 * 输出：
 * - 无返回值，直接原地修改 `candidates`。
 *
 * 控制逻辑：
 * - 如果候选集里已存在该 ID，则直接跳过。
 * - 只读取生成详情页链接和标签所需的最小字段。
 */
export async function collectEntityCandidate(
  prisma: Prisma.TransactionClient | PrismaClient,
  entityId: string,
  candidates: Map<string, { id: string; slug: string; title: string; entityType: string }>
) {
  if (candidates.has(entityId)) {
    return;
  }

  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      slug: true,
      title: true,
      entityType: true
    }
  });

  if (!entity) {
    return;
  }

  candidates.set(entity.id, {
    id: entity.id,
    slug: entity.slug,
    title: entity.title,
    entityType: entity.entityType
  });
}
