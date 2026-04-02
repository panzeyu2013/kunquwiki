import { PrismaClient } from "@prisma/client";
import { loadSeedData } from "./loaders";
import { logInfo, logStep } from "./utils/logger";
import { importUsers } from "./importers/users";
import { importSources } from "./importers/sources";
import { importMediaAssets } from "./importers/mediaAssets";
import {
  importArticles,
  importCities,
  importEvents,
  importPersons,
  importRoles,
  importTopics,
  importTroupes,
  importVenues,
  importWorks
} from "./importers/entities";
import {
  importEntityRelations,
  importEventParticipants,
  importEventProgramItems,
  importEventTroupes,
  importMemberships,
  importPerformanceCasts,
  importPersonIdentities
} from "./importers/relations";
import { importRevisions } from "./importers/revisions";
import { importProposals } from "./importers/proposals";
import { importDiscussions } from "./importers/discussions";
import { importSearchIndex } from "./importers/searchIndex";
import { SeedContext } from "./utils/entity";

export async function runSeed() {
  const prisma = new PrismaClient();
  try {
    const data = loadSeedData();

    logStep("Clearing existing data");
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.discussionPost.deleteMany(),
      prisma.discussionThread.deleteMany(),
      prisma.performanceCast.deleteMany(),
      prisma.eventTroupe.deleteMany(),
      prisma.eventParticipant.deleteMany(),
      prisma.eventProgramItem.deleteMany(),
      prisma.personTroupeMembership.deleteMany(),
      prisma.personIdentity.deleteMany(),
      prisma.entityRelation.deleteMany(),
      prisma.entitySourceRef.deleteMany(),
      prisma.source.deleteMany(),
      prisma.searchIndex.deleteMany(),
      prisma.editProposal.deleteMany(),
      prisma.entityRevision.deleteMany(),
      prisma.entityContent.deleteMany(),
      prisma.event.deleteMany(),
      prisma.article.deleteMany(),
      prisma.work.deleteMany(),
      prisma.person.deleteMany(),
      prisma.troupe.deleteMany(),
      prisma.venue.deleteMany(),
      prisma.role.deleteMany(),
      prisma.topic.deleteMany(),
      prisma.mediaAsset.deleteMany(),
      prisma.entityAlias.deleteMany(),
      prisma.entity.deleteMany(),
      prisma.user.deleteMany()
    ]);

    logStep("Importing users");
    const userByUsername = await importUsers(prisma, data.users);

    logStep("Importing sources");
    const sourceByKey = await importSources(prisma, data.sources);

    logStep("Importing media assets");
    const mediaByKey = await importMediaAssets(prisma, data.mediaAssets);

    const ctx: SeedContext = {
      prisma,
      userByUsername,
      sourceByKey,
      mediaByKey,
      entityIdBySlug: new Map()
    };

    logStep("Importing core entities");
    await importCities(ctx, data.cities);
    await importWorks(ctx, data.works);
    await importPersons(ctx, data.persons);
    await importTroupes(ctx, data.troupes);
    await importVenues(ctx, data.venues);
    await importEvents(ctx, data.events);
    await importArticles(ctx, data.articles);
    await importRoles(ctx, data.roles);
    await importTopics(ctx, data.topics);

    logStep("Importing identities and memberships");
    await importPersonIdentities(ctx, data.personIdentities);
    await importMemberships(ctx, data.memberships);

    logStep("Importing relations");
    await importEntityRelations(ctx, data.relations);

    logStep("Importing event program items & casts");
    const programItemIdByKey = await importEventProgramItems(ctx, data.eventProgramItems);
    await importPerformanceCasts(ctx, data.performanceCasts, programItemIdByKey);
    await importEventParticipants(ctx, data.eventParticipants);
    await importEventTroupes(ctx, data.eventTroupes);

    logStep("Importing revisions, proposals, discussions");
    await importRevisions(ctx, data.revisions);
    await importProposals(ctx, data.proposals);
    await importDiscussions(ctx, data.discussions);

    logStep("Generating search index");
    await importSearchIndex(prisma);

    logInfo("Seed completed");
  } finally {
    await prisma.$disconnect();
  }
}
