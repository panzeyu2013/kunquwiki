import { ArticleType, EntityType, EventStatus, EventType, IdentityTerm, Prisma, TroupeType, WorkType } from "@prisma/client";
import {
  normalizeEventPayload,
  type PrismaLike
} from "./content.validation";
import {
  parseDateForUpdate,
  toEventProgramItems,
  toIdentityTerm,
  toObjectArray,
  toPerformanceCasts,
  toPersonIdentities,
  toStringArray,
  toTroupeMemberships
} from "./content.utils";

/**
 * 将审核通过或快速创建时提交的结构化 payload 写回对应子表。
 *
 * 输入：
 * - `tx`: 当前事务 client，保证主表、子表、关联表写入原子性。
 * - `entityType`: 目标实体类型，决定写入哪个子表以及如何处理关联数据。
 * - `entityId`: 要写回的实体主键。
 * - `payload`: 已经过关系校验和必要规范化的结构化数据。
 *
 * 输出：
 * - 无显式返回值；函数完成后，相关子表和桥接表会更新为最新状态。
 *
 * 控制逻辑：
 * 1. 按 `entityType` 进入不同分支，分别处理各子表字段。
 * 2. 对“整组替换”的数据，如人物身份、院团成员关系、活动节目单，先删后建。
 * 3. 活动写回阶段会再次使用 `normalizeEventPayload`，确保审核流与快速创建流行为一致。
 * 4. `PerformanceCast` 的最小合法性约束由前置校验承担，这里只负责稳定落库。
 *
 * 所需组件：
 * - `normalizeEventPayload` 统一活动城市/场馆逻辑。
 * - `parseDateForUpdate` 统一日期反序列化。
 * - `toPersonIdentities` / `toTroupeMemberships` / `toEventProgramItems` / `toPerformanceCasts`
 *   负责把前端数组结构转换成数据库写入格式。
 */
export async function applyStructuredProposal(
  tx: Prisma.TransactionClient,
  entityType: EntityType,
  entityId: string,
  payload: Record<string, unknown>
) {
  switch (entityType) {
    case "work":
      await tx.work.update({
        where: { entityId },
        data: {
          ...(typeof payload.workType === "string" ? { workType: payload.workType as WorkType } : {}),
          ...(typeof payload.parentWorkId === "string" || payload.parentWorkId === null
            ? { parentWorkId: typeof payload.parentWorkId === "string" && payload.parentWorkId.length > 0 ? payload.parentWorkId : null }
            : {}),
          ...(typeof payload.originalAuthor === "string" ? { originalAuthor: payload.originalAuthor } : {}),
          ...(typeof payload.dynastyPeriod === "string" ? { dynastyPeriod: payload.dynastyPeriod } : {}),
          ...(typeof payload.genreNote === "string" ? { genreNote: payload.genreNote } : {}),
          ...(typeof payload.synopsis === "string" ? { synopsis: payload.synopsis } : {}),
          ...(typeof payload.plot === "string" ? { plot: payload.plot } : {}),
          ...(typeof payload.durationMinutes === "number" ? { durationMinutes: payload.durationMinutes } : {}),
          ...(payload.durationMinutes === null ? { durationMinutes: null } : {}),
          ...(typeof payload.firstKnownDate === "string" ? { firstKnownDate: payload.firstKnownDate } : {})
        }
      });
      break;
    case "person": {
      const deathDateInput = payload.deathDate;
      const isLivingInput = payload.isLiving;
      const nextDeathDate = parseDateForUpdate(deathDateInput, "deathDate");
      const nextIsLiving =
        typeof isLivingInput === "boolean" ? isLivingInput : isLivingInput === null ? null : undefined;

      const personData: Prisma.PersonUpdateInput = {
        ...(typeof payload.personTypeNote === "string" ? { personTypeNote: payload.personTypeNote } : {}),
        ...(typeof payload.gender === "string" ? { gender: payload.gender } : {}),
        ...(typeof payload.birthDate === "string" || payload.birthDate === null
          ? { birthDate: parseDateForUpdate(payload.birthDate, "birthDate") }
          : {}),
        ...(typeof payload.birthCityId === "string" || payload.birthCityId === null
          ? { birthCityEntityId: typeof payload.birthCityId === "string" && payload.birthCityId.length > 0 ? payload.birthCityId : null }
          : {}),
        ...(typeof payload.bio === "string" ? { bio: payload.bio } : {})
      };

      if (nextDeathDate !== undefined) {
        personData.deathDate = nextDeathDate;
      }
      if (nextIsLiving !== undefined) {
        personData.isLiving = nextIsLiving;
      }
      if (nextDeathDate instanceof Date) {
        personData.isLiving = false;
      }
      if ((nextIsLiving === true || nextIsLiving === null) && deathDateInput === undefined) {
        personData.deathDate = null;
      }

      await tx.person.update({
        where: { entityId },
        data: personData
      });

      if (Array.isArray(payload.personIdentities)) {
        await tx.personIdentity.deleteMany({ where: { personEntityId: entityId } });
        const identities = toPersonIdentities(toObjectArray(payload.personIdentities));
        if (identities.length > 0) {
          await tx.personIdentity.createMany({
            data: identities.map((identity) => ({ ...identity, personEntityId: entityId }))
          });
        }
      } else if (Array.isArray(payload.identities)) {
        const identities = payload.identities.map((identity) => toIdentityTerm(identity)).filter((identity): identity is IdentityTerm => Boolean(identity));
        await tx.personIdentity.deleteMany({ where: { personEntityId: entityId } });
        if (identities.length > 0) {
          await tx.personIdentity.createMany({
            data: identities.map((identity) => ({
              personEntityId: entityId,
              identityTerm: identity
            }))
          });
        }
      }

      if (Array.isArray(payload.troupeMemberships)) {
        await tx.personTroupeMembership.deleteMany({ where: { personEntityId: entityId } });
        const memberships = toTroupeMemberships(toObjectArray(payload.troupeMemberships));
        if (memberships.length > 0) {
          await tx.personTroupeMembership.createMany({
            data: memberships.map((membership) => ({
              ...membership,
              personEntityId: entityId
            }))
          });
        }
      } else if (Array.isArray(payload.troupeIds)) {
        await tx.personTroupeMembership.deleteMany({ where: { personEntityId: entityId } });
        const troupeIds = toStringArray(payload.troupeIds);
        if (troupeIds.length > 0) {
          await tx.personTroupeMembership.createMany({
            data: troupeIds.map((troupeId) => ({
              personEntityId: entityId,
              troupeEntityId: troupeId,
              membershipRole: "成员",
              isCurrent: true
            }))
          });
        }
      }
      break;
    }
    case "city":
      await tx.city.update({
        where: { entityId },
        data: {
          ...(typeof payload.province === "string" ? { province: payload.province } : {})
        }
      });
      break;
    case "troupe":
      await tx.troupe.update({
        where: { entityId },
        data: {
          ...(typeof payload.troupeType === "string" ? { troupeType: payload.troupeType as TroupeType } : {}),
          ...(typeof payload.foundedDate === "string" || payload.foundedDate === null
            ? { foundedDate: parseDateForUpdate(payload.foundedDate, "foundedDate") }
            : {}),
          ...(typeof payload.dissolvedDate === "string" || payload.dissolvedDate === null
            ? { dissolvedDate: parseDateForUpdate(payload.dissolvedDate, "dissolvedDate") }
            : {}),
          ...(typeof payload.cityId === "string" || payload.cityId === null
            ? { cityEntityId: typeof payload.cityId === "string" && payload.cityId.length > 0 ? payload.cityId : null }
            : {}),
          ...(typeof payload.cityText === "string" || typeof payload.city === "string"
            ? { cityText: typeof payload.cityText === "string" ? payload.cityText : String(payload.city) }
            : {}),
          ...(typeof payload.regionText === "string" || typeof payload.region === "string"
            ? { regionText: typeof payload.regionText === "string" ? payload.regionText : String(payload.region) }
            : {}),
          ...(typeof payload.description === "string" ? { description: payload.description } : {}),
          ...(typeof payload.officialWebsite === "string" ? { officialWebsite: payload.officialWebsite } : {})
        }
      });
      break;
    case "venue":
      await tx.venue.update({
        where: { entityId },
        data: {
          ...(typeof payload.venueType === "string" ? { venueType: payload.venueType } : {}),
          ...(typeof payload.countryText === "string" || typeof payload.country === "string"
            ? { countryText: typeof payload.countryText === "string" ? payload.countryText : String(payload.country) }
            : {}),
          ...(typeof payload.cityId === "string" || payload.cityId === null
            ? { cityEntityId: typeof payload.cityId === "string" && payload.cityId.length > 0 ? payload.cityId : null }
            : {}),
          ...(typeof payload.cityText === "string" || typeof payload.city === "string"
            ? { cityText: typeof payload.cityText === "string" ? payload.cityText : String(payload.city) }
            : {}),
          ...(typeof payload.regionText === "string" || typeof payload.region === "string"
            ? { regionText: typeof payload.regionText === "string" ? payload.regionText : String(payload.region) }
            : {}),
          ...(typeof payload.address === "string" ? { address: payload.address } : {}),
          ...(typeof payload.latitude === "number" ? { latitude: payload.latitude } : {}),
          ...(payload.latitude === null ? { latitude: null } : {}),
          ...(typeof payload.longitude === "number" ? { longitude: payload.longitude } : {}),
          ...(payload.longitude === null ? { longitude: null } : {}),
          ...(typeof payload.capacity === "number" ? { capacity: payload.capacity } : {}),
          ...(payload.capacity === null ? { capacity: null } : {}),
          ...(typeof payload.description === "string" ? { description: payload.description } : {})
        }
      });
      break;
    case "event": {
      const normalizedPayload = await normalizeEventPayload(tx as PrismaLike, payload);
      const nextCityId =
        typeof normalizedPayload.cityId === "string"
          ? normalizedPayload.cityId
          : normalizedPayload.cityId === null
            ? null
            : undefined;
      const nextVenueId =
        typeof normalizedPayload.venueEntityId === "string"
          ? normalizedPayload.venueEntityId
          : normalizedPayload.venueEntityId === null
            ? null
            : undefined;
      const nextStartAt =
        typeof normalizedPayload.startAt === "string" ? parseDateForUpdate(normalizedPayload.startAt, "startAt") : undefined;

      await tx.event.update({
        where: { entityId },
        data: {
          ...(typeof normalizedPayload.eventType === "string" ? { eventType: normalizedPayload.eventType as EventType } : {}),
          ...(typeof normalizedPayload.businessStatus === "string"
            ? { businessStatus: normalizedPayload.businessStatus as EventStatus }
            : {}),
          ...(nextStartAt instanceof Date ? { startAt: nextStartAt } : {}),
          ...(typeof normalizedPayload.endAt === "string" || normalizedPayload.endAt === null
            ? { endAt: parseDateForUpdate(normalizedPayload.endAt, "endAt") }
            : {}),
          ...(nextCityId === undefined ? {} : { cityEntityId: nextCityId }),
          ...(nextVenueId === undefined ? {} : { venueEntityId: nextVenueId }),
          ...(typeof normalizedPayload.ticketUrl === "string" ? { ticketUrl: normalizedPayload.ticketUrl } : {}),
          ...(typeof normalizedPayload.duration === "string" ? { durationText: normalizedPayload.duration } : {}),
          ...(typeof normalizedPayload.durationText === "string" ? { durationText: normalizedPayload.durationText } : {}),
          ...(typeof normalizedPayload.ticketStatus === "string" ? { ticketStatus: normalizedPayload.ticketStatus } : {}),
          ...(typeof normalizedPayload.noteText === "string" ? { noteText: normalizedPayload.noteText } : {}),
          ...(typeof normalizedPayload.posterImageId === "string" || normalizedPayload.posterImageId === null
            ? { posterImageId: normalizedPayload.posterImageId && normalizedPayload.posterImageId.length > 0 ? normalizedPayload.posterImageId : null }
            : {})
        }
      });

      if (Array.isArray(normalizedPayload.troupeIds)) {
        await tx.eventTroupe.deleteMany({ where: { eventEntityId: entityId } });
        const troupeIds = toStringArray(normalizedPayload.troupeIds);
        if (troupeIds.length > 0) {
          await tx.eventTroupe.createMany({
            data: troupeIds.map((troupeId, index) => ({
              eventEntityId: entityId,
              troupeEntityId: troupeId,
              sortOrder: index
            }))
          });
        }
      } else if (typeof normalizedPayload.troupeId === "string" && normalizedPayload.troupeId.length > 0) {
        await tx.eventTroupe.deleteMany({ where: { eventEntityId: entityId } });
        await tx.eventTroupe.create({
          data: {
            eventEntityId: entityId,
            troupeEntityId: normalizedPayload.troupeId,
            sortOrder: 0
          }
        });
      }

      if (Array.isArray(normalizedPayload.programDetailed)) {
        await tx.performanceCast.deleteMany({
          where: {
            programItem: {
              eventEntityId: entityId
            }
          }
        });
        await tx.eventProgramItem.deleteMany({ where: { eventEntityId: entityId } });
        const items = toEventProgramItems(toObjectArray(normalizedPayload.programDetailed));
        const roleToWorkMap = new Map<string, string>();
        for (const item of items) {
          const created = await tx.eventProgramItem.create({
            data: {
              eventEntityId: entityId,
              workEntityId: item.workEntityId,
              titleOverride: item.titleOverride,
              sequenceNo: item.sequenceNo,
              durationMinutes: item.durationMinutes,
              notes: item.notes
            }
          });
          const casts = toPerformanceCasts(item.casts);
          if (casts.length > 0) {
            await tx.performanceCast.createMany({
              data: casts.map((cast) => ({
                ...cast,
                eventProgramItemId: created.id
              }))
            });
          }
          if (item.workEntityId) {
            for (const cast of casts) {
              if (cast.roleEntityId) {
                roleToWorkMap.set(cast.roleEntityId, item.workEntityId);
              }
            }
          }
        }
        for (const [roleEntityId, workEntityId] of roleToWorkMap) {
          await tx.role.updateMany({
            where: {
              entityId: roleEntityId,
              OR: [{ workEntityId: null }, { workEntityId }]
            },
            data: {
              workEntityId
            }
          });
        }
      } else if (Array.isArray(normalizedPayload.programWorkIds) || Array.isArray(normalizedPayload.programExcerptIds)) {
        await tx.eventProgramItem.deleteMany({ where: { eventEntityId: entityId } });
        const workIds = Array.isArray(normalizedPayload.programWorkIds) ? toStringArray(normalizedPayload.programWorkIds) : [];
        const excerptIds = Array.isArray(normalizedPayload.programExcerptIds) ? toStringArray(normalizedPayload.programExcerptIds) : [];
        const allIds = [...workIds, ...excerptIds];
        if (allIds.length > 0) {
          await tx.eventProgramItem.createMany({
            data: allIds.map((workId, index) => ({
              eventEntityId: entityId,
              workEntityId: workId,
              sequenceNo: index + 1
            }))
          });
        }
      }
      break;
    }
    case "article":
      await tx.article.update({
        where: { entityId },
        data: {
          ...(typeof payload.articleType === "string" ? { articleType: payload.articleType as ArticleType } : {}),
          ...(typeof payload.abstract === "string" ? { abstract: payload.abstract } : {}),
          ...(typeof payload.difficultyLevel === "string" ? { difficultyLevel: payload.difficultyLevel } : {}),
          ...(typeof payload.bodySourceType === "string" ? { bodySourceType: payload.bodySourceType } : {})
        }
      });
      break;
    default:
      break;
  }
}
