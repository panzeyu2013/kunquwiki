import {
  ArticleType,
  EventStatus,
  EventType,
  IdentityTerm,
  ProposalStatus,
  PublishStatus,
  ReviewStatus,
  TroupeType,
  UserRole,
  UserStatus,
  WorkType
} from "@prisma/client";
import { loadJsonFile } from "./loadJson";
import { SeedData, SeedEventProgramItem, SeedRevision } from "../types";
import { assertEnumValue, assertRequired, assertUnique } from "../utils/validate";

const enumValues = {
  ArticleType: Object.values(ArticleType),
  EventStatus: Object.values(EventStatus),
  EventType: Object.values(EventType),
  IdentityTerm: Object.values(IdentityTerm),
  ProposalStatus: Object.values(ProposalStatus),
  PublishStatus: Object.values(PublishStatus),
  ReviewStatus: Object.values(ReviewStatus),
  TroupeType: Object.values(TroupeType),
  UserRole: Object.values(UserRole),
  UserStatus: Object.values(UserStatus),
  WorkType: Object.values(WorkType)
};

export function loadSeedData(): SeedData {
  const data: SeedData = {
    users: loadJsonFile("users.json"),
    sources: loadJsonFile("sources.json"),
    mediaAssets: loadJsonFile("mediaAssets.json"),
    cities: loadJsonFile("cities.json"),
    works: loadJsonFile("works.json"),
    persons: loadJsonFile("persons.json"),
    troupes: loadJsonFile("troupes.json"),
    venues: loadJsonFile("venues.json"),
    events: loadJsonFile("events.json"),
    articles: loadJsonFile("articles.json"),
    roles: loadJsonFile("roles.json"),
    topics: loadJsonFile("topics.json"),
    personIdentities: loadJsonFile("personIdentities.json"),
    memberships: loadJsonFile("memberships.json"),
    eventProgramItems: loadJsonFile("eventProgramItems.json"),
    performanceCasts: loadJsonFile("performanceCasts.json"),
    eventParticipants: loadJsonFile("eventParticipants.json"),
    eventTroupes: loadJsonFile("eventTroupes.json"),
    relations: loadJsonFile("relations.json"),
    revisions: loadJsonFile("revisions.json"),
    proposals: loadJsonFile("proposals.json"),
    discussions: loadJsonFile("discussions.json")
  };

  validateSeedData(data);
  return data;
}

function validateSeedData(data: SeedData) {
  assertUnique(data.users.map((u) => u.username), "users.username");
  assertUnique(data.users.map((u) => u.email), "users.email");
  for (const user of data.users) {
    if (user.status) assertEnumValue(user.status, enumValues.UserStatus, `Invalid user status: ${user.status}`);
    for (const role of user.roles) {
      assertEnumValue(role, enumValues.UserRole, `Invalid user role: ${role}`);
    }
  }

  assertUnique(data.sources.map((s) => s.key), "sources.key");
  assertUnique(data.mediaAssets.map((a) => a.key), "mediaAssets.key");

  const entitySlugs = [
    ...data.cities.map((i) => i.slug),
    ...data.works.map((i) => i.slug),
    ...data.persons.map((i) => i.slug),
    ...data.troupes.map((i) => i.slug),
    ...data.venues.map((i) => i.slug),
    ...data.events.map((i) => i.slug),
    ...data.articles.map((i) => i.slug),
    ...data.roles.map((i) => i.slug),
    ...data.topics.map((i) => i.slug)
  ];
  assertUnique(entitySlugs, "entity.slug");

  for (const work of data.works) {
    assertEnumValue(work.workType, enumValues.WorkType, `Invalid workType for ${work.slug}`);
  }
  for (const troupe of data.troupes) {
    assertEnumValue(troupe.troupeType, enumValues.TroupeType, `Invalid troupeType for ${troupe.slug}`);
  }
  for (const event of data.events) {
    assertEnumValue(event.eventType, enumValues.EventType, `Invalid eventType for ${event.slug}`);
    assertEnumValue(event.businessStatus, enumValues.EventStatus, `Invalid event status for ${event.slug}`);
  }
  for (const article of data.articles) {
    assertEnumValue(article.articleType, enumValues.ArticleType, `Invalid articleType for ${article.slug}`);
  }
  for (const identity of data.personIdentities) {
    assertEnumValue(identity.identityTerm, enumValues.IdentityTerm, `Invalid identityTerm for ${identity.personSlug}`);
  }
  for (const revision of data.revisions) {
    assertEnumValue(revision.reviewStatus, enumValues.ReviewStatus, `Invalid reviewStatus for ${revision.entitySlug}`);
  }
  for (const proposal of data.proposals) {
    if (proposal.status) {
      assertEnumValue(proposal.status, enumValues.ProposalStatus, `Invalid proposal status for ${proposal.proposerUsername}`);
    }
  }

  const slugSet = new Set(entitySlugs);
  const sourceKeySet = new Set(data.sources.map((s) => s.key));
  const mediaKeySet = new Set(data.mediaAssets.map((m) => m.key));

  const assertSlug = (value: string | null | undefined, message: string) => {
    if (!value) return;
    assertRequired(slugSet.has(value), message);
  };

  const assertSourceKey = (value: string | null | undefined, message: string) => {
    if (!value) return;
    assertRequired(sourceKeySet.has(value), message);
  };

  const assertMediaKey = (value: string | null | undefined, message: string) => {
    if (!value) return;
    assertRequired(mediaKeySet.has(value), message);
  };

  const validateSources = (file: string, slug: string, sources: { sourceKey: string }[] | undefined) => {
    sources?.forEach((source) => {
      assertSourceKey(source.sourceKey, `${file}: Unknown sourceKey ${source.sourceKey} for ${slug}`);
    });
  };
  const validateCover = (file: string, slug: string, coverImageKey?: string | null) => {
    assertMediaKey(coverImageKey ?? undefined, `${file}: Unknown coverImageKey ${coverImageKey} for ${slug}`);
  };

  data.cities.forEach((record) => {
    validateSources("cities.json", record.slug, record.sources);
    validateCover("cities.json", record.slug, record.coverImageKey);
  });
  data.works.forEach((record) => {
    validateSources("works.json", record.slug, record.sources);
    validateCover("works.json", record.slug, record.coverImageKey);
  });
  data.persons.forEach((record) => {
    validateSources("persons.json", record.slug, record.sources);
    validateCover("persons.json", record.slug, record.coverImageKey);
  });
  data.troupes.forEach((record) => {
    validateSources("troupes.json", record.slug, record.sources);
    validateCover("troupes.json", record.slug, record.coverImageKey);
  });
  data.venues.forEach((record) => {
    validateSources("venues.json", record.slug, record.sources);
    validateCover("venues.json", record.slug, record.coverImageKey);
  });
  data.events.forEach((record) => {
    validateSources("events.json", record.slug, record.sources);
    validateCover("events.json", record.slug, record.coverImageKey);
  });
  data.articles.forEach((record) => {
    validateSources("articles.json", record.slug, record.sources);
    validateCover("articles.json", record.slug, record.coverImageKey);
  });
  data.roles.forEach((record) => {
    validateSources("roles.json", record.slug, record.sources);
    validateCover("roles.json", record.slug, record.coverImageKey);
  });
  data.topics.forEach((record) => {
    validateSources("topics.json", record.slug, record.sources);
    validateCover("topics.json", record.slug, record.coverImageKey);
  });

  data.persons.forEach((person) => {
    assertSlug(person.birthCitySlug, `persons.json: Unknown birthCitySlug ${person.birthCitySlug} for ${person.slug}`);
  });
  data.works.forEach((work) => {
    assertSlug(work.parentWorkSlug, `works.json: Unknown parentWorkSlug ${work.parentWorkSlug} for ${work.slug}`);
  });
  data.troupes.forEach((troupe) => {
    assertSlug(troupe.citySlug, `troupes.json: Unknown citySlug ${troupe.citySlug} for ${troupe.slug}`);
  });
  data.venues.forEach((venue) => {
    assertSlug(venue.citySlug, `venues.json: Unknown citySlug ${venue.citySlug} for ${venue.slug}`);
  });
  data.events.forEach((event) => {
    assertSlug(event.citySlug, `events.json: Unknown citySlug ${event.citySlug} for ${event.slug}`);
    assertSlug(event.venueSlug, `events.json: Unknown venueSlug ${event.venueSlug} for ${event.slug}`);
    assertMediaKey(event.posterImageKey ?? undefined, `events.json: Unknown posterImageKey ${event.posterImageKey} for ${event.slug}`);
  });
  data.roles.forEach((role) => {
    assertSlug(role.workSlug, `roles.json: Unknown workSlug ${role.workSlug} for ${role.slug}`);
  });

  for (const identity of data.personIdentities) {
    assertSlug(identity.personSlug, `personIdentities.json: Unknown personSlug ${identity.personSlug}`);
  }
  for (const membership of data.memberships) {
    assertSlug(membership.personSlug, `memberships.json: Unknown personSlug ${membership.personSlug}`);
    assertSlug(membership.troupeSlug, `memberships.json: Unknown troupeSlug ${membership.troupeSlug}`);
  }

  validateProgramItems(data.eventProgramItems, slugSet);

  for (const cast of data.performanceCasts) {
    const programItemKeySet = new Set(data.eventProgramItems.map((item) => item.key));
    assertRequired(
      programItemKeySet.has(cast.programItemKey),
      `performanceCasts.json: Unknown programItemKey ${cast.programItemKey}`
    );
    assertSlug(cast.roleSlug, `performanceCasts.json: Unknown roleSlug ${cast.roleSlug}`);
    assertSlug(cast.personSlug, `performanceCasts.json: Unknown personSlug ${cast.personSlug}`);
  }

  for (const participant of data.eventParticipants) {
    assertSlug(participant.eventSlug, `eventParticipants.json: Unknown eventSlug ${participant.eventSlug}`);
    assertSlug(participant.personSlug, `eventParticipants.json: Unknown personSlug ${participant.personSlug}`);
  }
  for (const troupeLink of data.eventTroupes) {
    assertSlug(troupeLink.eventSlug, `eventTroupes.json: Unknown eventSlug ${troupeLink.eventSlug}`);
    assertSlug(troupeLink.troupeSlug, `eventTroupes.json: Unknown troupeSlug ${troupeLink.troupeSlug}`);
  }

  for (const relation of data.relations) {
    assertSlug(relation.fromSlug, `relations.json: Unknown fromSlug ${relation.fromSlug}`);
    assertSlug(relation.toSlug, `relations.json: Unknown toSlug ${relation.toSlug}`);
  }

  validateRevisions(data.revisions, slugSet);

  for (const proposal of data.proposals) {
    if (proposal.entitySlug) assertSlug(proposal.entitySlug, `proposals.json: Unknown entitySlug ${proposal.entitySlug}`);
  }

  for (const discussion of data.discussions) {
    assertSlug(discussion.entitySlug, `discussions.json: Unknown entitySlug ${discussion.entitySlug}`);
  }
}

function validateProgramItems(items: SeedEventProgramItem[], slugSet: Set<string>) {
  const programKeySet = new Set<string>();
  const eventSequence = new Map<string, Set<number>>();
  for (const item of items) {
    assertRequired(!programKeySet.has(item.key), `eventProgramItems.json: Duplicate program item key ${item.key}`);
    programKeySet.add(item.key);
    assertRequired(slugSet.has(item.eventSlug), `eventProgramItems.json: Unknown eventSlug ${item.eventSlug}`);
    if (item.workSlug) {
      assertRequired(slugSet.has(item.workSlug), `eventProgramItems.json: Unknown workSlug ${item.workSlug}`);
    }
    const key = item.eventSlug;
    if (!eventSequence.has(key)) eventSequence.set(key, new Set());
    const set = eventSequence.get(key)!;
    assertRequired(
      !set.has(item.sequenceNo),
      `eventProgramItems.json: Duplicate sequenceNo ${item.sequenceNo} for event ${item.eventSlug}`
    );
    set.add(item.sequenceNo);
  }
}

function validateRevisions(revisions: SeedRevision[], slugSet: Set<string>) {
  const map = new Map<string, Set<number>>();
  for (const revision of revisions) {
    assertRequired(slugSet.has(revision.entitySlug), `revisions.json: Unknown entitySlug ${revision.entitySlug}`);
    if (!map.has(revision.entitySlug)) map.set(revision.entitySlug, new Set());
    const set = map.get(revision.entitySlug)!;
    assertRequired(
      !set.has(revision.revisionNo),
      `revisions.json: Duplicate revisionNo ${revision.revisionNo} for ${revision.entitySlug}`
    );
    set.add(revision.revisionNo);
  }
}
