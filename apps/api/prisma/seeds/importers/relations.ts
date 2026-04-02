import { SeedEventParticipant, SeedEventProgramItem, SeedEventTroupe, SeedMembership, SeedPerformanceCast, SeedPersonIdentity, SeedEntityRelation } from "../types";
import { parseOptionalDate } from "../utils/date";
import { SeedContext } from "../utils/entity";

export async function importPersonIdentities(ctx: SeedContext, identities: SeedPersonIdentity[]) {
  for (const identity of identities) {
    const personId = ctx.entityIdBySlug.get(identity.personSlug);
    if (!personId) throw new Error(`Unknown personSlug ${identity.personSlug} in personIdentities`);
    await ctx.prisma.personIdentity.create({
      data: {
        personEntityId: personId,
        identityTerm: identity.identityTerm,
        startDate: parseOptionalDate(identity.startDate) ?? null,
        endDate: parseOptionalDate(identity.endDate) ?? null
      }
    });
  }
}

export async function importMemberships(ctx: SeedContext, memberships: SeedMembership[]) {
  for (const membership of memberships) {
    const personId = ctx.entityIdBySlug.get(membership.personSlug);
    const troupeId = ctx.entityIdBySlug.get(membership.troupeSlug);
    if (!personId) throw new Error(`Unknown personSlug ${membership.personSlug} in memberships`);
    if (!troupeId) throw new Error(`Unknown troupeSlug ${membership.troupeSlug} in memberships`);
    await ctx.prisma.personTroupeMembership.create({
      data: {
        personEntityId: personId,
        troupeEntityId: troupeId,
        membershipRole: membership.membershipRole,
        startDate: parseOptionalDate(membership.startDate) ?? null,
        endDate: parseOptionalDate(membership.endDate) ?? null,
        isCurrent: membership.isCurrent ?? false
      }
    });
  }
}

export async function importEventProgramItems(ctx: SeedContext, items: SeedEventProgramItem[]) {
  const programItemIdByKey = new Map<string, string>();
  for (const item of items) {
    const eventId = ctx.entityIdBySlug.get(item.eventSlug);
    if (!eventId) throw new Error(`Unknown eventSlug ${item.eventSlug} in eventProgramItems`);
    const workId = item.workSlug ? ctx.entityIdBySlug.get(item.workSlug) ?? null : null;
    const created = await ctx.prisma.eventProgramItem.create({
      data: {
        eventEntityId: eventId,
        workEntityId: workId,
        titleOverride: item.titleOverride ?? null,
        sequenceNo: item.sequenceNo,
        durationMinutes: item.durationMinutes ?? null,
        notes: item.notes ?? null
      }
    });
    programItemIdByKey.set(item.key, created.id);
  }
  return programItemIdByKey;
}

export async function importPerformanceCasts(
  ctx: SeedContext,
  casts: SeedPerformanceCast[],
  programItemIdByKey: Map<string, string>
) {
  for (const cast of casts) {
    const programItemId = programItemIdByKey.get(cast.programItemKey);
    if (!programItemId) throw new Error(`Unknown programItemKey ${cast.programItemKey} in performanceCasts`);
    const roleId = cast.roleSlug ? ctx.entityIdBySlug.get(cast.roleSlug) ?? null : null;
    const personId = cast.personSlug ? ctx.entityIdBySlug.get(cast.personSlug) ?? null : null;
    await ctx.prisma.performanceCast.create({
      data: {
        eventProgramItemId: programItemId,
        roleEntityId: roleId,
        personEntityId: personId,
        castNote: cast.castNote ?? null
      }
    });
  }
}

export async function importEventParticipants(ctx: SeedContext, participants: SeedEventParticipant[]) {
  for (const participant of participants) {
    const eventId = ctx.entityIdBySlug.get(participant.eventSlug);
    if (!eventId) throw new Error(`Unknown eventSlug ${participant.eventSlug} in eventParticipants`);
    const personId = participant.personSlug ? ctx.entityIdBySlug.get(participant.personSlug) ?? null : null;
    await ctx.prisma.eventParticipant.create({
      data: {
        eventEntityId: eventId,
        personEntityId: personId,
        participationRole: participant.participationRole,
        creditedAs: participant.creditedAs ?? null,
        sortOrder: participant.sortOrder ?? 0
      }
    });
  }
}

export async function importEventTroupes(ctx: SeedContext, links: SeedEventTroupe[]) {
  for (const link of links) {
    const eventId = ctx.entityIdBySlug.get(link.eventSlug);
    const troupeId = ctx.entityIdBySlug.get(link.troupeSlug);
    if (!eventId) throw new Error(`Unknown eventSlug ${link.eventSlug} in eventTroupes`);
    if (!troupeId) throw new Error(`Unknown troupeSlug ${link.troupeSlug} in eventTroupes`);
    await ctx.prisma.eventTroupe.create({
      data: {
        eventEntityId: eventId,
        troupeEntityId: troupeId,
        sortOrder: link.sortOrder ?? 0
      }
    });
  }
}

export async function importEntityRelations(ctx: SeedContext, relations: SeedEntityRelation[]) {
  for (const relation of relations) {
    const fromId = ctx.entityIdBySlug.get(relation.fromSlug);
    const toId = ctx.entityIdBySlug.get(relation.toSlug);
    if (!fromId) throw new Error(`Unknown fromSlug ${relation.fromSlug} in relations`);
    if (!toId) throw new Error(`Unknown toSlug ${relation.toSlug} in relations`);
    await ctx.prisma.entityRelation.create({
      data: {
        fromEntityId: fromId,
        toEntityId: toId,
        relationType: relation.relationType,
        note: relation.note ?? null,
        sortOrder: relation.sortOrder ?? 0
      }
    });
  }
}
