import { ArticleType, EventStatus, EventType, TroupeType, WorkType } from "@prisma/client";
import { FullEntity } from "./content.types";
import { excerptText } from "./content.utils";

/**
 * 将素材表记录转换成前端更容易直接消费的轻量对象。
 *
 * 输入：
 * - `asset`: 已经通过 Prisma include 取出的素材记录，允许为空。
 *
 * 输出：
 * - 有素材时返回可直接序列化的素材信息。
 * - 无素材时返回 `undefined`，避免接口里出现多余的空对象。
 *
 * 控制逻辑：
 * - 这里只做字段整形和 `null -> undefined` 转换，不负责权限和 URL 处理。
 */
function mapMediaAsset(asset?: {
  id: string;
  assetType: string;
  url: string;
  mimeType: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
} | null) {
  if (!asset) {
    return undefined;
  }

  return {
    id: asset.id,
    assetType: asset.assetType,
    url: asset.url,
    mimeType: asset.mimeType ?? undefined,
    altText: asset.altText ?? undefined,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined
  };
}

/**
 * 聚合活动列表中的城市展示名，并输出热门城市统计。
 *
 * 输入：
 * - `cityAggregation`: 仅包含统计所需最小字段的活动-场馆城市数据。
 *
 * 输出：
 * - 返回 `{ city, count }[]`，按出现次数倒序排列。
 *
 * 控制逻辑：
 * 1. 展示优先级遵循“标准城市实体标题优先，其次文本兜底”。
 * 2. 聚合过程中跳过完全没有城市信息的记录。
 * 3. 最后统一排序，供首页/统计接口直接使用。
 */
export function buildTopCities(
  cityAggregation: Array<{ venue: { cityText: string; cityRecord: { entity: { title: string } } | null } | null }>
) {
  const cityCounts = new Map<string, number>();
  for (const event of cityAggregation) {
    const cityName = event.venue?.cityRecord?.entity.title ?? event.venue?.cityText;
    if (!cityName) {
      continue;
    }

    cityCounts.set(cityName, (cityCounts.get(cityName) ?? 0) + 1);
  }

  return [...cityCounts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
}

/**
 * 将带有子表和关系的 Prisma `Entity` 记录映射成 API 返回对象。
 *
 * 输入：
 * - `entity`: 使用 `entityInclude` 读取出来的完整实体。
 *
 * 输出：
 * - 返回按实体类型展开后的详情/列表通用响应结构。
 *
 * 控制逻辑：
 * 1. 先构造所有实体共享的基础字段。
 * 2. 再根据 `Entity.entityType` 分支拼接各子表结构化字段。
 * 3. 正文统一优先读取 `EntityContent.bodyMarkdown`。
 * 4. 位置展示遵循“关联实体优先，文本字段兜底”的总体契约。
 *
 * 所需组件：
 * - `excerptText` 负责为摘要字段提供回退文案。
 * - `mapMediaAsset` 负责把封面/海报映射成可展示对象。
 */
export function mapEntity(entity: FullEntity) {
  const base = {
    id: entity.id,
    entityType: entity.entityType,
    slug: entity.slug,
    title: entity.title,
    subtitle: entity.subtitle ?? undefined,
    status: entity.status,
    body: entity.content?.bodyMarkdown ?? "待补充",
    coverImageId: entity.coverImageId ?? undefined,
    coverImage: mapMediaAsset(entity.coverImage),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    references: entity.sourceRefs.map((item) => ({
      title: item.source.title,
      url: item.source.sourceUrl ?? undefined,
      publisher: item.source.publisher ?? undefined
    }))
  };

  switch (entity.entityType) {
    case "work":
      return {
        ...base,
        workType: entity.work?.workType ?? WorkType.full_play,
        originalAuthor: entity.work?.originalAuthor ?? undefined,
        dynastyPeriod: entity.work?.dynastyPeriod ?? undefined,
        genreNote: entity.work?.genreNote ?? undefined,
        parentWorkId: entity.work?.parentWorkId ?? undefined,
        synopsis: entity.work?.synopsis ?? excerptText(entity.work?.plot ?? entity.content?.bodyMarkdown ?? "待补充"),
        plot: entity.work?.plot ?? entity.content?.bodyMarkdown ?? "待补充",
        durationMinutes: entity.work?.durationMinutes ?? undefined,
        firstKnownDate: entity.work?.firstKnownDate ?? undefined
      };
    case "person":
      return {
        ...base,
        roles: entity.person?.identities.map((item) => item.identityTerm) ?? [],
        personTypeNote: entity.person?.personTypeNote ?? undefined,
        gender: entity.person?.gender ?? undefined,
        birthDate: entity.person?.birthDate?.toISOString(),
        deathDate: entity.person?.deathDate?.toISOString(),
        birthCityId: entity.person?.birthCityEntityId ?? undefined,
        isLiving: entity.person?.isLiving ?? undefined,
        troupeIds: entity.person?.troupeMemberships.map((item) => item.troupeEntityId) ?? [],
        personIdentities: (entity.person?.identities ?? []).map((item) => ({
          id: item.id,
          identityTerm: item.identityTerm,
          startDate: item.startDate?.toISOString(),
          endDate: item.endDate?.toISOString()
        })),
        troupeMemberships: (entity.person?.troupeMemberships ?? []).map((item) => ({
          id: item.id,
          troupeEntityId: item.troupeEntityId,
          membershipRole: item.membershipRole,
          startDate: item.startDate?.toISOString(),
          endDate: item.endDate?.toISOString(),
          isCurrent: item.isCurrent
        })),
        representativeWorkIds: entity.outgoingRelations.filter((item) => item.relationType === "rep_work").map((item) => item.toEntityId),
        representativeExcerptIds: entity.outgoingRelations.filter((item) => item.relationType === "rep_excerpt").map((item) => item.toEntityId),
        bio: entity.person?.bio ?? entity.content?.bodyMarkdown ?? "待补充"
      };
    case "troupe":
      return {
        ...base,
        cityId: entity.troupe?.cityEntityId ?? undefined,
        foundedDate: entity.troupe?.foundedDate?.toISOString(),
        dissolvedDate: entity.troupe?.dissolvedDate?.toISOString(),
        cityText: entity.troupe?.cityText ?? "",
        regionText: entity.troupe?.regionText ?? "",
        troupeType: entity.troupe?.troupeType ?? TroupeType.troupe,
        officialWebsite: entity.troupe?.officialWebsite ?? undefined,
        description: entity.troupe?.description ?? undefined
      };
    case "venue":
      return {
        ...base,
        venueType: entity.venue?.venueType ?? "theater",
        countryText: entity.venue?.countryText ?? "中国",
        cityId: entity.venue?.cityEntityId ?? undefined,
        cityText: entity.venue?.cityText ?? "",
        regionText: entity.venue?.regionText ?? "",
        address: entity.venue?.address ?? "",
        latitude: entity.venue?.latitude ? Number(entity.venue.latitude) : undefined,
        longitude: entity.venue?.longitude ? Number(entity.venue.longitude) : undefined,
        capacity: entity.venue?.capacity ?? undefined,
        description: entity.venue?.description ?? undefined
      };
    case "event":
      return {
        ...base,
        eventType: entity.event?.eventType ?? EventType.performance,
        businessStatus: entity.event?.businessStatus ?? EventStatus.announced,
        startAt: entity.event?.startAt.toISOString() ?? entity.createdAt.toISOString(),
        endAt: entity.event?.endAt?.toISOString(),
        cityId: entity.event?.cityEntityId ?? undefined,
        venueId: entity.event?.venueEntityId ?? undefined,
        troupeIds: (entity.event?.troupes ?? []).map((link) => link.troupeEntityId),
        ticketUrl: entity.event?.ticketUrl ?? undefined,
        duration: entity.event?.durationText ?? undefined,
        ticketStatus: entity.event?.ticketStatus ?? undefined,
        noteText: entity.event?.noteText ?? undefined,
        posterImageId: entity.event?.posterImageId ?? undefined,
        posterImage: mapMediaAsset(entity.event?.posterImage),
        program: (entity.event?.programItems ?? []).map((item) => ({
          id: item.id,
          title: item.titleOverride ?? item.work?.entity.title ?? "未命名节目",
          workId: item.workEntityId ?? undefined,
          workType: item.work?.workType as WorkType | undefined,
          sequenceNo: item.sequenceNo,
          durationMinutes: item.durationMinutes ?? undefined,
          casts: (item.casts ?? []).map((cast) => ({
            id: cast.id,
            roleId: cast.roleEntityId ?? undefined,
            personId: cast.personEntityId ?? undefined,
            castNote: cast.castNote ?? undefined
          }))
        })),
        programDetailed: (entity.event?.programItems ?? []).map((item) => ({
          id: item.id,
          workEntityId: item.workEntityId ?? undefined,
          titleOverride: item.titleOverride ?? undefined,
          sequenceNo: item.sequenceNo,
          durationMinutes: item.durationMinutes ?? undefined,
          notes: item.notes ?? undefined,
          casts: (item.casts ?? []).map((cast) => ({
            id: cast.id,
            roleEntityId: cast.roleEntityId ?? undefined,
            personEntityId: cast.personEntityId ?? undefined,
            castNote: cast.castNote ?? undefined
          }))
        }))
      };
    case "city":
      return {
        ...base,
        province: entity.city?.province ?? ""
      };
    case "article":
      return {
        ...base,
        articleType: entity.article?.articleType ?? ArticleType.term,
        abstract: entity.article?.abstract ?? undefined,
        difficultyLevel: entity.article?.difficultyLevel ?? undefined,
        bodySourceType: entity.article?.bodySourceType ?? undefined,
        body: entity.content?.bodyMarkdown ?? "待补充"
      };
    default:
      return base;
  }
}
