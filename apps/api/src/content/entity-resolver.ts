import { EntityType, PrismaClient } from "@prisma/client";
import type { AIEventDraft } from "./event-ai.parser";

export type ResolveResult = {
  resolved: {
    cityId?: string;
    venueId?: string;
    troupeIds?: string[];
    programDetailed?: Array<{
      title?: string;
      workEntityId?: string;
      casts?: Array<{
        roleName?: string;
        roleEntityId?: string;
        personName?: string;
        personEntityId?: string;
      }>;
    }>;
  };
  unmatched: {
    cityName?: string;
    venueName?: string;
    troupeNames?: string[];
    workTitles?: string[];
    roleNames?: string[];
    personNames?: string[];
  };
  warnings: string[];
};

type ResolvedProgramItem = NonNullable<ResolveResult["resolved"]["programDetailed"]>[number];
type ResolvedProgramCast = NonNullable<ResolvedProgramItem["casts"]>[number];

export async function resolveEventEntities(prisma: PrismaClient, parsed: AIEventDraft): Promise<ResolveResult> {
  const warnings: string[] = [];
  const resolved: ResolveResult["resolved"] = {};
  const unmatched: ResolveResult["unmatched"] = {};
  const entityCache = new Map<EntityType, Array<{ id: string; title: string }>>();

  const matchCached = async (entityType: EntityType, name: string, aliases: Array<string | undefined> = []) => {
    const normalized = normalizeName(name);
    if (!normalized) {
      return null;
    }
    let entities = entityCache.get(entityType);
    if (!entities) {
      entities = await prisma.entity.findMany({
        where: { entityType },
        select: { id: true, title: true }
      });
      entityCache.set(entityType, entities);
    }
    return matchEntityInList(entities, name, aliases);
  };

  if (parsed.cityName) {
    const cityMatch = await matchCached(EntityType.city, parsed.cityName);
    if (cityMatch?.id) {
      resolved.cityId = cityMatch.id;
    } else {
      unmatched.cityName = parsed.cityName;
      warnings.push(`未能在数据库匹配城市：${parsed.cityName}`);
    }
  }

  if (parsed.venueName) {
    const venueMatch = await matchCached(EntityType.venue, parsed.venueName, [
      simplifyVenueName(parsed.venueName),
      stripCityPrefix(parsed.venueName, parsed.cityName)
    ]);
    if (venueMatch?.id) {
      resolved.venueId = venueMatch.id;
      const venueRecord = await prisma.venue.findUnique({ where: { entityId: venueMatch.id }, select: { cityEntityId: true } });
      if (venueRecord?.cityEntityId) {
        if (resolved.cityId && resolved.cityId !== venueRecord.cityEntityId) {
          warnings.push("解析城市与场馆城市不一致，请确认是否需要调整。");
          resolved.cityId = undefined;
        } else if (!resolved.cityId) {
          resolved.cityId = venueRecord.cityEntityId;
        }
      }
    } else {
      unmatched.venueName = parsed.venueName;
      warnings.push(`未能在数据库匹配场馆：${parsed.venueName}`);
    }
  }

  if (parsed.troupeNames && parsed.troupeNames.length > 0) {
    const troupeIds: string[] = [];
    const missingTroupes: string[] = [];
    for (const name of parsed.troupeNames) {
      const troupeMatch = await matchCached(EntityType.troupe, name);
      if (troupeMatch?.id) {
        troupeIds.push(troupeMatch.id);
      } else {
        missingTroupes.push(name);
      }
    }
    if (troupeIds.length > 0) {
      resolved.troupeIds = troupeIds;
    }
    if (missingTroupes.length > 0) {
      unmatched.troupeNames = missingTroupes;
      warnings.push(`未能在数据库匹配剧团：${missingTroupes.join("、")}`);
    }
  }

  const programItems =
    parsed.programDetailed && parsed.programDetailed.length > 0
      ? parsed.programDetailed
      : parsed.programTitles && parsed.programTitles.length > 0
        ? parsed.programTitles.map((title) => ({ title, casts: [] }))
        : [];

  if (programItems.length > 0) {
    const missingWorks = new Set<string>();
    const missingRoles = new Set<string>();
    const missingPeople = new Set<string>();
    const programResolved = [];

    for (const item of programItems) {
      const resolvedItem: ResolvedProgramItem = {
        title: item.title,
        workEntityId: undefined,
        casts: []
      };
      if (item.title) {
        const workMatch = await matchCached(EntityType.work, item.title);
        if (workMatch?.id) {
          resolvedItem.workEntityId = workMatch.id;
        } else {
          missingWorks.add(item.title);
        }
      }

      const casts = Array.isArray(item.casts) ? item.casts : [];
      for (const cast of casts) {
        const resolvedCast: ResolvedProgramCast = {
          roleName: cast.roleName,
          personName: cast.personName,
          roleEntityId: undefined,
          personEntityId: undefined
        };
        if (cast.roleName) {
          const roleMatch = await matchCached(EntityType.role, cast.roleName);
          if (roleMatch?.id) {
            resolvedCast.roleEntityId = roleMatch.id;
          } else {
            missingRoles.add(cast.roleName);
          }
        }
        if (cast.personName) {
          const personMatch = await matchCached(EntityType.person, cast.personName);
          if (personMatch?.id) {
            resolvedCast.personEntityId = personMatch.id;
          } else {
            missingPeople.add(cast.personName);
          }
        }
        resolvedItem.casts?.push(resolvedCast);
      }
      programResolved.push(resolvedItem);
    }

    if (programResolved.length > 0) {
      resolved.programDetailed = programResolved;
    }
    if (missingWorks.size > 0) {
      unmatched.workTitles = Array.from(missingWorks);
      warnings.push(`未能在数据库匹配剧目：${Array.from(missingWorks).join("、")}`);
    }
    if (missingRoles.size > 0) {
      unmatched.roleNames = Array.from(missingRoles);
      warnings.push(`未能在数据库匹配角色：${Array.from(missingRoles).join("、")}`);
    }
    if (missingPeople.size > 0) {
      unmatched.personNames = Array.from(missingPeople);
      warnings.push(`未能在数据库匹配演员：${Array.from(missingPeople).join("、")}`);
    }
  }

  return { resolved, unmatched, warnings };
}

type MatchCandidate = { id: string; title: string; score: number };

function matchEntityInList(
  entities: Array<{ id: string; title: string }>,
  name: string,
  aliases: Array<string | undefined> = []
) {
  const candidates: MatchCandidate[] = [];
  const aliasList = [name, ...aliases].filter(Boolean) as string[];

  for (const entity of entities) {
    const score = bestSimilarity(aliasList, entity.title);
    if (score > 0) {
      candidates.push({ id: entity.id, title: entity.title, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return null;
  }

  if (best.score >= 0.82) {
    return best;
  }

  return null;
}

function bestSimilarity(inputs: string[], candidate: string) {
  let best = 0;
  for (const input of inputs) {
    const score = similarityScore(input, candidate);
    if (score > best) {
      best = score;
    }
  }
  return best;
}

function similarityScore(a: string, b: string) {
  const setA = toBigrams(normalizeName(a));
  const setB = toBigrams(normalizeName(b));
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function toBigrams(value: string) {
  const normalized = normalizeName(value);
  const set = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[·・\-]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/(昆曲|剧团|剧场|剧院|大剧院|戏院|艺术中心)/g, "")
    .trim();
}

function simplifyVenueName(value: string) {
  return value.replace(/(昆山|上海|北京|苏州|南京)/g, "");
}

function stripCityPrefix(value: string, cityName?: string) {
  if (!cityName) {
    return value;
  }
  return value.replace(new RegExp(`^${cityName}`), "");
}
