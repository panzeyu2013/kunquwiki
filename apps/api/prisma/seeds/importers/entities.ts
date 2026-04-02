import { EventStatus, EventType } from "@prisma/client";
import {
  SeedArticle,
  SeedCity,
  SeedEvent,
  SeedPerson,
  SeedRole,
  SeedTopic,
  SeedTroupe,
  SeedVenue,
  SeedWork
} from "../types";
import { parseDate, parseOptionalDate } from "../utils/date";
import { createBaseEntity, SeedContext } from "../utils/entity";

export async function importCities(ctx: SeedContext, cities: SeedCity[]) {
  for (const city of cities) {
    await createBaseEntity(ctx, {
      ...city,
      entityType: "city",
      nested: {
        city: {
          create: {
            province: city.province
          }
        }
      }
    });
  }
}

export async function importWorks(ctx: SeedContext, works: SeedWork[]) {
  for (const work of works) {
    const parentWorkId = work.parentWorkSlug ? ctx.entityIdBySlug.get(work.parentWorkSlug) ?? null : null;
    await createBaseEntity(ctx, {
      ...work,
      entityType: "work",
      nested: {
        work: {
          create: {
            workType: work.workType,
            parentWorkId,
            originalAuthor: work.originalAuthor ?? null,
            dynastyPeriod: work.dynastyPeriod ?? null,
            genreNote: work.genreNote ?? null,
            synopsis: work.synopsis,
            plot: work.plot,
            durationMinutes: work.durationMinutes ?? null,
            firstKnownDate: work.firstKnownDate ?? null
          }
        }
      }
    });
  }
}

export async function importPersons(ctx: SeedContext, persons: SeedPerson[]) {
  for (const person of persons) {
    const birthCityId = person.birthCitySlug ? ctx.entityIdBySlug.get(person.birthCitySlug) ?? null : null;
    await createBaseEntity(ctx, {
      ...person,
      entityType: "person",
      nested: {
        person: {
          create: {
            personTypeNote: person.personTypeNote ?? null,
            gender: person.gender ?? null,
            birthDate: parseDate(person.birthDate),
            deathDate: parseDate(person.deathDate),
            birthCityEntityId: birthCityId,
            bio: person.bio,
            isLiving: person.isLiving ?? null
          }
        }
      }
    });
  }
}

export async function importTroupes(ctx: SeedContext, troupes: SeedTroupe[]) {
  for (const troupe of troupes) {
    const cityId = troupe.citySlug ? ctx.entityIdBySlug.get(troupe.citySlug) ?? null : null;
    await createBaseEntity(ctx, {
      ...troupe,
      entityType: "troupe",
      nested: {
        troupe: {
          create: {
            troupeType: troupe.troupeType,
            foundedDate: parseOptionalDate(troupe.foundedDate) ?? null,
            dissolvedDate: parseOptionalDate(troupe.dissolvedDate) ?? null,
            cityEntityId: cityId,
            cityText: troupe.cityText ?? null,
            regionText: troupe.regionText ?? null,
            description: troupe.description,
            officialWebsite: troupe.officialWebsite ?? null
          }
        }
      }
    });
  }
}

export async function importVenues(ctx: SeedContext, venues: SeedVenue[]) {
  for (const venue of venues) {
    const cityId = venue.citySlug ? ctx.entityIdBySlug.get(venue.citySlug) ?? null : null;
    await createBaseEntity(ctx, {
      ...venue,
      entityType: "venue",
      nested: {
        venue: {
          create: {
            venueType: venue.venueType,
            countryText: venue.countryText ?? "中国",
            cityEntityId: cityId,
            regionText: venue.regionText,
            cityText: venue.cityText,
            address: venue.address,
            latitude: venue.latitude ?? null,
            longitude: venue.longitude ?? null,
            capacity: venue.capacity ?? null,
            description: venue.description ?? null
          }
        }
      }
    });
  }
}

export async function importEvents(ctx: SeedContext, events: SeedEvent[]) {
  for (const event of events) {
    const cityId = event.citySlug ? ctx.entityIdBySlug.get(event.citySlug) ?? null : null;
    const venueId = event.venueSlug ? ctx.entityIdBySlug.get(event.venueSlug) ?? null : null;
    const posterImageId = event.posterImageKey ? ctx.mediaByKey.get(event.posterImageKey) ?? null : null;
    await createBaseEntity(ctx, {
      ...event,
      entityType: "event",
      nested: {
        event: {
          create: {
            eventType: event.eventType ?? EventType.performance,
            businessStatus: event.businessStatus ?? EventStatus.announced,
            startAt: parseOptionalDate(event.startAt) ?? new Date(),
            endAt: parseOptionalDate(event.endAt) ?? null,
            timezone: event.timezone ?? "Asia/Shanghai",
            cityEntityId: cityId,
            venueEntityId: venueId,
            organizerText: event.organizerText ?? null,
            ticketUrl: event.ticketUrl ?? null,
            durationText: event.durationText ?? null,
            ticketStatus: event.ticketStatus ?? null,
            noteText: event.noteText ?? null,
            posterImageId,
            lastVerifiedAt: parseOptionalDate(event.lastVerifiedAt) ?? null
          }
        }
      }
    });
  }
}

export async function importArticles(ctx: SeedContext, articles: SeedArticle[]) {
  for (const article of articles) {
    await createBaseEntity(ctx, {
      ...article,
      entityType: "article",
      nested: {
        article: {
          create: {
            articleType: article.articleType,
            abstract: article.abstract ?? null,
            difficultyLevel: article.difficultyLevel ?? null,
            bodySourceType: article.bodySourceType ?? null
          }
        }
      }
    });
  }
}

export async function importRoles(ctx: SeedContext, roles: SeedRole[]) {
  for (const role of roles) {
    const workId = role.workSlug ? ctx.entityIdBySlug.get(role.workSlug) ?? null : null;
    await createBaseEntity(ctx, {
      ...role,
      entityType: "role",
      nested: {
        roleRecord: {
          create: {
            workEntityId: workId,
            roleCategory: role.roleCategory ?? null,
            description: role.description ?? null
          }
        }
      }
    });
  }
}

export async function importTopics(ctx: SeedContext, topics: SeedTopic[]) {
  for (const topic of topics) {
    await createBaseEntity(ctx, {
      ...topic,
      entityType: "topic",
      nested: {
        topic: {
          create: {
            topicType: topic.topicType,
            heroText: topic.heroText ?? null,
            layoutJson: topic.layoutJson ?? undefined
          }
        }
      }
    });
  }
}
