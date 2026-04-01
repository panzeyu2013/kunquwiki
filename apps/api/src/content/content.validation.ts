import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityType, Prisma, PrismaClient } from "@prisma/client";
import { toNullableString, toObjectArray, toStringArray } from "./content.utils";

export type PrismaLike = Prisma.TransactionClient | PrismaClient;

/**
 * 将实体枚举值转换成面向表单错误提示的中文标签。
 *
 * 输入：
 * - `entityType`: Prisma `EntityType` 枚举值。
 *
 * 输出：
 * - 返回可直接拼进校验错误消息的中文类型名。
 *
 * 控制逻辑：
 * - 这里只负责消息文案，不参与任何数据库查询。
 * - 当引用类型不匹配时，调用方会用这个结果生成更可读的异常提示。
 */
function mapEntityTypeLabel(entityType: EntityType) {
  switch (entityType) {
    case EntityType.city:
      return "城市";
    case EntityType.troupe:
      return "院团";
    case EntityType.venue:
      return "场馆";
    case EntityType.work:
      return "剧目";
    case EntityType.person:
      return "人物";
    case EntityType.article:
      return "词条";
    case EntityType.event:
      return "活动";
    case EntityType.role:
      return "角色";
    case EntityType.topic:
      return "专题";
  }
}

/**
 * 校验某个实体引用是否存在，且它的真实类型与业务预期一致。
 *
 * 输入：
 * - `db`: Prisma client 或事务 client。
 * - `entityId`: 被引用实体的主键 ID。
 * - `expectedType`: 当前字段允许引用的实体类型。
 * - `field`: 触发校验的字段名，用于错误提示。
 *
 * 输出：
 * - 返回最小实体信息 `{ id, entityType, title }`，供上层在后续逻辑中继续使用。
 *
 * 控制逻辑：
 * 1. 先按 ID 查询实体是否存在。
 * 2. 再校验 `Entity.entityType` 是否与预期一致。
 * 3. 任一步失败都直接抛出面向 API 的异常，阻止脏关系写入。
 */
export async function ensureEntityReference(db: PrismaLike, entityId: string, expectedType: EntityType, field: string) {
  const entity = await db.entity.findUnique({
    where: { id: entityId },
    select: { id: true, entityType: true, title: true }
  });

  if (!entity) {
    throw new NotFoundException(`${field} 指向的条目不存在`);
  }

  if (entity.entityType !== expectedType) {
    throw new BadRequestException(`${field} 必须引用${mapEntityTypeLabel(expectedType)}`);
  }

  return entity;
}

/**
 * 校验素材引用是否存在。
 *
 * 输入：
 * - `db`: Prisma client 或事务 client。
 * - `assetId`: 待校验的 `MediaAsset.id`。
 * - `field`: 触发校验的字段名，用于构造错误提示。
 *
 * 输出：
 * - 无显式返回值；若素材不存在则抛出异常。
 *
 * 控制逻辑：
 * - 当前版本只校验存在性，不做素材类型或使用权限判断。
 * - 主要用于 `coverImageId` / `posterImageId` 这类引用侧防守。
 */
export async function ensureMediaAssetExists(db: PrismaLike, assetId: string, field: string) {
  const asset = await db.mediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true }
  });

  if (!asset) {
    throw new NotFoundException(`${field} 指向的素材不存在`);
  }
}

/**
 * 规范化活动 payload，并在需要时根据场馆自动补齐城市。
 *
 * 输入：
 * - `db`: Prisma client 或事务 client。
 * - `payload`: 原始活动提交数据。
 *
 * 输出：
 * - 返回一个浅拷贝后的 payload，其中可能自动写入 `cityId`。
 *
 * 控制逻辑：
 * 1. 没有传场馆时不做额外处理，直接返回。
 * 2. 传了场馆时，先确认该场馆实体存在且类型正确。
 * 3. 若活动未显式填写城市且场馆已绑定城市，则自动回填 `cityId`。
 * 4. 若活动城市与场馆城市同时存在但不一致，则抛出业务错误。
 *
 * 所需组件：
 * - `ensureEntityReference` 用于验证场馆引用。
 * - `venue` 子表读取用于获取场馆归属城市。
 */
export async function normalizeEventPayload(db: PrismaLike, payload: Record<string, unknown>) {
  const normalized = { ...payload };

  const venueId =
    typeof normalized.venueEntityId === "string" && normalized.venueEntityId.trim().length > 0 ? normalized.venueEntityId : null;
  const cityId =
    typeof normalized.cityId === "string" && normalized.cityId.trim().length > 0 ? normalized.cityId : normalized.cityId === null ? null : undefined;

  if (!venueId) {
    return normalized;
  }

  const venueEntity = await ensureEntityReference(db, venueId, EntityType.venue, "venueEntityId");
  const venue = await db.venue.findUnique({
    where: { entityId: venueEntity.id },
    select: { cityEntityId: true }
  });

  if (!venue) {
    throw new NotFoundException("所选场馆不存在");
  }

  if (cityId === undefined && venue.cityEntityId) {
    normalized.cityId = venue.cityEntityId;
    return normalized;
  }

  if (cityId && venue.cityEntityId && cityId !== venue.cityEntityId) {
    throw new BadRequestException("所选活动城市与场馆所属城市不一致，请先修正后再提交。");
  }

  return normalized;
}

/**
 * 对结构化 payload 中的外键引用做统一业务校验，并返回规范化后的结果。
 *
 * 输入：
 * - `db`: Prisma client 或事务 client。
 * - `entityType`: 当前正在处理的实体类型，决定需要检查哪些字段。
 * - `rawPayload`: 原始提交 payload。
 *
 * 输出：
 * - 返回经过活动城市补齐等预处理后的 payload 副本。
 *
 * 控制逻辑：
 * 1. `event` 先经过 `normalizeEventPayload`，统一城市/场馆关系。
 * 2. 通用字段先校验素材引用，例如 `coverImageId`。
 * 3. 再按实体类型分支校验不同的实体关系。
 * 4. `PerformanceCast` 在这里做最小必要约束，禁止角色和人物同时为空。
 *
 * 所需组件：
 * - `ensureEntityReference`
 * - `ensureMediaAssetExists`
 * - `toNullableString` / `toObjectArray` / `toStringArray`
 */
export async function validateRelationshipPayload(db: PrismaLike, entityType: EntityType, rawPayload: Record<string, unknown>) {
  const payload = entityType === EntityType.event ? await normalizeEventPayload(db, rawPayload) : { ...rawPayload };

  const coverImageId = toNullableString(payload.coverImageId);
  if (coverImageId) {
    await ensureMediaAssetExists(db, coverImageId, "coverImageId");
  }

  switch (entityType) {
    case EntityType.work: {
      const parentWorkId = toNullableString(payload.parentWorkId);
      if (parentWorkId) {
        await ensureEntityReference(db, parentWorkId, EntityType.work, "parentWorkId");
      }
      break;
    }
    case EntityType.person: {
      const birthCityId = toNullableString(payload.birthCityId);
      if (birthCityId) {
        await ensureEntityReference(db, birthCityId, EntityType.city, "birthCityId");
      }
      for (const item of toObjectArray(payload.troupeMemberships)) {
        const troupeEntityId = toNullableString(item.troupeEntityId);
        if (troupeEntityId) {
          await ensureEntityReference(db, troupeEntityId, EntityType.troupe, "troupeMemberships.troupeEntityId");
        }
      }
      for (const troupeId of Array.isArray(payload.troupeIds) ? toStringArray(payload.troupeIds) : []) {
        await ensureEntityReference(db, troupeId, EntityType.troupe, "troupeIds");
      }
      for (const workId of Array.isArray(payload.representativeWorkIds) ? toStringArray(payload.representativeWorkIds) : []) {
        await ensureEntityReference(db, workId, EntityType.work, "representativeWorkIds");
      }
      for (const workId of Array.isArray(payload.representativeExcerptIds) ? toStringArray(payload.representativeExcerptIds) : []) {
        await ensureEntityReference(db, workId, EntityType.work, "representativeExcerptIds");
      }
      break;
    }
    case EntityType.troupe:
    case EntityType.venue: {
      const cityId = toNullableString(payload.cityId);
      if (cityId) {
        await ensureEntityReference(db, cityId, EntityType.city, "cityId");
      }
      break;
    }
    case EntityType.role: {
      const workEntityId = toNullableString(payload.workEntityId);
      if (workEntityId) {
        await ensureEntityReference(db, workEntityId, EntityType.work, "workEntityId");
      }
      break;
    }
    case EntityType.event: {
      const cityId = toNullableString(payload.cityId);
      if (cityId) {
        await ensureEntityReference(db, cityId, EntityType.city, "cityId");
      }
      const venueEntityId = toNullableString(payload.venueEntityId);
      if (venueEntityId) {
        await ensureEntityReference(db, venueEntityId, EntityType.venue, "venueEntityId");
      }
      const posterImageId = toNullableString(payload.posterImageId);
      if (posterImageId) {
        await ensureMediaAssetExists(db, posterImageId, "posterImageId");
      }
      for (const troupeId of Array.isArray(payload.troupeIds) ? toStringArray(payload.troupeIds) : []) {
        await ensureEntityReference(db, troupeId, EntityType.troupe, "troupeIds");
      }
      for (const item of toObjectArray(payload.programDetailed)) {
        const workEntityId = toNullableString(item.workEntityId);
        if (workEntityId) {
          await ensureEntityReference(db, workEntityId, EntityType.work, "programDetailed.workEntityId");
        }
        for (const cast of toObjectArray(item.casts)) {
          const roleEntityId = toNullableString(cast.roleEntityId);
          const personEntityId = toNullableString(cast.personEntityId);
          if (!roleEntityId && !personEntityId) {
            throw new BadRequestException("演员表记录至少需要选择角色或人物其中之一。");
          }
          if (roleEntityId) {
            await ensureEntityReference(db, roleEntityId, EntityType.role, "programDetailed.casts.roleEntityId");
          }
          if (personEntityId) {
            await ensureEntityReference(db, personEntityId, EntityType.person, "programDetailed.casts.personEntityId");
          }
        }
      }
      for (const workId of Array.isArray(payload.programWorkIds) ? toStringArray(payload.programWorkIds) : []) {
        await ensureEntityReference(db, workId, EntityType.work, "programWorkIds");
      }
      for (const workId of Array.isArray(payload.programExcerptIds) ? toStringArray(payload.programExcerptIds) : []) {
        await ensureEntityReference(db, workId, EntityType.work, "programExcerptIds");
      }
      break;
    }
    default:
      break;
  }

  return payload;
}
