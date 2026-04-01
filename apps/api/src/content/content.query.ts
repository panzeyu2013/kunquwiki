import { NotFoundException } from "@nestjs/common";
import { EventStatus, Prisma, ProposalStatus, PublishStatus } from "@prisma/client";
import { buildTopCities, mapEntity } from "./content.mapper";
import { buildTopWorks, getEntityEventRecords, getRelatedEntities } from "./content.reads";
import { entityInclude } from "./content.types";
import { normalizeSlugInput } from "./content.utils";
import { PrismaService } from "../prisma.service";

export type ListEntitiesParams = {
  type?: string;
  q?: string;
  city?: string;
  status?: string;
  troupe?: string;
  person?: string;
  work?: string;
  venue?: string;
};

/**
 * 组装首页所需的精选内容、最近修订和整体统计数据。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 *
 * 输出：
 * - 返回首页 hero、精选活动/剧目/人物、最近变更和站点统计的聚合对象。
 *
 * 控制逻辑：
 * 1. 分别查询精选活动、剧目和人物。
 * 2. 统一通过 `mapEntity` 转换成前端响应结构。
 * 3. 复用 `getRecentChanges` 与 `getStats` 保持首页和后台统计口径一致。
 */
export async function getHomePayload(prisma: PrismaService) {
  const featuredEvents = await prisma.entity.findMany({
    where: {
      entityType: "event",
      status: PublishStatus.published,
      event: {
        businessStatus: {
          in: [EventStatus.announced, EventStatus.scheduled]
        }
      }
    },
    include: entityInclude,
    take: 3,
    orderBy: {
      event: {
        startAt: "asc"
      }
    }
  });

  const featuredWorks = await prisma.entity.findMany({
    where: {
      entityType: "work",
      status: PublishStatus.published
    },
    include: entityInclude,
    take: 3
  });

  const featuredPeople = await prisma.entity.findMany({
    where: {
      entityType: "person",
      status: PublishStatus.published
    },
    include: entityInclude,
    take: 3
  });

  return {
    hero: {
      title: "KunquWiki",
      subtitle: "公开可协作的昆曲资料库、演出库与知识站"
    },
    featuredEvents: featuredEvents.map((item) => mapEntity(item)),
    featuredWorks: featuredWorks.map((item) => mapEntity(item)),
    featuredPeople: featuredPeople.map((item) => mapEntity(item)),
    recentChanges: await getRecentChanges(prisma),
    stats: await getStats(prisma)
  };
}

/**
 * 根据实体类型和筛选条件返回条目列表。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `params`: 页面列表和后台筛选面板提交的查询条件。
 *
 * 输出：
 * - 返回映射后的实体数组，适用于列表页和后台搜索结果。
 *
 * 控制逻辑：
 * 1. 根据 `type` 拼装不同的 Prisma `where` 条件。
 * 2. 事件筛选额外支持城市、场馆、院团、人物、剧目等组合条件。
 * 3. 查询结果统一经 `mapEntity` 输出，避免列表和详情口径分裂。
 */
export async function listEntities(prisma: PrismaService, params?: ListEntitiesParams) {
  const { type, q, city, status, troupe, person, work, venue } = params ?? {};
  const where = {
    ...(type ? { entityType: type as never } : {}),
    ...(q && type !== "event"
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { is: { bodyMarkdown: { contains: q, mode: "insensitive" } } } }
          ]
        }
      : {}),
    ...(type === "person" && city
      ? {
          person: {
            is: {
              OR: [
                {
                  birthCity: {
                    is: {
                      entity: {
                        is: {
                          title: {
                            contains: city,
                            mode: Prisma.QueryMode.insensitive
                          }
                        }
                      }
                    }
                  }
                },
                {
                  troupeMemberships: {
                    some: {
                      troupe: {
                        cityRecord: {
                          is: {
                            entity: {
                              is: {
                                title: {
                                  contains: city,
                                  mode: Prisma.QueryMode.insensitive
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      : {}),
    ...(type === "event" && (city || status || troupe || person || work || venue || q)
      ? {
          event: {
            ...(status ? { businessStatus: status as EventStatus } : {}),
            AND: [
              ...(city
                ? [
                    {
                      OR: [
                        {
                          city: {
                            entity: {
                              title: {
                                contains: city,
                                mode: "insensitive"
                              }
                            }
                          }
                        },
                        {
                          venue: {
                            cityText: {
                              contains: city,
                              mode: "insensitive"
                            }
                          }
                        }
                      ]
                    }
                  ]
                : []),
              ...(venue
                ? [
                    {
                      venue: {
                        entity: {
                          title: {
                            contains: venue,
                            mode: "insensitive"
                          }
                        }
                      }
                    }
                  ]
                : []),
              ...(troupe
                ? [
                    {
                      troupes: {
                        some: {
                          troupe: {
                            entity: {
                              title: {
                                contains: troupe,
                                mode: "insensitive"
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                : []),
              ...(person
                ? [
                    {
                      OR: [
                        {
                          programItems: {
                            some: {
                              casts: {
                                some: {
                                  person: {
                                    entity: {
                                      title: {
                                        contains: person,
                                        mode: "insensitive"
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        },
                        {
                          participants: {
                            some: {
                              person: {
                                entity: {
                                  title: {
                                    contains: person,
                                    mode: "insensitive"
                                  }
                                }
                              }
                            }
                          }
                        }
                      ]
                    }
                  ]
                : []),
              ...(work
                ? [
                    {
                      programItems: {
                        some: {
                          work: {
                            entity: {
                              title: {
                                contains: work,
                                mode: "insensitive"
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                : []),
              ...(q
                ? [
                    {
                      OR: [
                        {
                          entity: {
                            title: {
                              contains: q,
                              mode: "insensitive"
                            }
                          }
                        },
                        {
                          entity: {
                            content: {
                              is: {
                                bodyMarkdown: {
                                  contains: q,
                                  mode: "insensitive"
                                }
                              }
                            }
                          }
                        },
                        {
                          troupe: {
                            entity: {
                              title: {
                                contains: q,
                                mode: "insensitive"
                              }
                            }
                          }
                        },
                        {
                          participants: {
                            some: {
                              person: {
                                entity: {
                                  title: {
                                    contains: q,
                                    mode: "insensitive"
                                  }
                                }
                              }
                            }
                          }
                        },
                        {
                          troupes: {
                            some: {
                              troupe: {
                                entity: {
                                  title: {
                                    contains: q,
                                    mode: "insensitive"
                                  }
                                }
                              }
                            }
                          }
                        },
                        {
                          venue: {
                            entity: {
                              title: {
                                contains: q,
                                mode: "insensitive"
                              }
                            }
                          }
                        },
                        {
                          programItems: {
                            some: {
                              work: {
                                entity: {
                                  title: {
                                    contains: q,
                                    mode: "insensitive"
                                  }
                                }
                              }
                            }
                          }
                        }
                      ]
                    }
                  ]
                : [])
            ]
          }
        }
      : {})
  } as Prisma.EntityWhereInput;

  const entities = await prisma.entity.findMany({
    where,
    include: entityInclude,
    orderBy: { updatedAt: "desc" }
  });

  return entities.map((item) => mapEntity(item));
}

/**
 * 按 slug 读取单个实体详情，并补齐相关条目与演出记录。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `slug`: 前端路由中的条目标识。
 *
 * 输出：
 * - 返回完整详情对象，包含基础字段、结构化字段、相关条目、未来演出和过往演出。
 *
 * 控制逻辑：
 * 1. 先用 `normalizeSlugInput` 统一 slug 形态。
 * 2. 查询不到实体时抛出 `NotFoundException`。
 * 3. 详情主体由 `mapEntity` 负责，周边关联由读取模块补齐。
 */
export async function getEntityBySlug(prisma: PrismaService, slug: string) {
  const normalizedSlug = normalizeSlugInput(slug);
  const entity = await prisma.entity.findUnique({
    where: { slug: normalizedSlug },
    include: entityInclude
  });

  if (!entity) {
    throw new NotFoundException(`Entity ${normalizedSlug} not found`);
  }

  const mapped = mapEntity(entity);
  return {
    ...mapped,
    relatedEntities: await getRelatedEntities(prisma, entity),
    upcomingEvents: await getEntityEventRecords(prisma, entity, "upcoming"),
    pastEvents: await getEntityEventRecords(prisma, entity, "past")
  };
}

/**
 * 对全文索引执行搜索；空查询时回退为最近更新内容。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 * - `query`: 用户输入的搜索词。
 * - `type`: 可选实体类型过滤。
 *
 * 输出：
 * - 返回按相关性排序的轻量搜索结果数组。
 *
 * 控制逻辑：
 * 1. 空查询直接读 `SearchIndex` 最近记录。
 * 2. 非空查询使用 PostgreSQL 全文搜索和相似度排序。
 * 3. 最后回表补齐 slug，保持搜索结果可直接跳转详情页。
 */
export async function search(prisma: PrismaService, query: string, type?: string) {
  if (!query.trim()) {
    const rows = await prisma.searchIndex.findMany({
      where: type ? { entityType: type as never } : undefined,
      take: 30,
      orderBy: { updatedAt: "desc" }
    });

    const baseRows = rows.map((item) => ({
      id: item.entityId,
      slug: "",
      title: item.title,
      entityType: item.entityType
    }));

    return Promise.all(
      baseRows.map(async (row) => {
        const entity = await prisma.entity.findUnique({ where: { id: row.id } });
        return { ...row, slug: entity?.slug ?? "" };
      })
    );
  }

  const rankedRows = await prisma.$queryRaw<Array<{ entityId: string; rank: number }>>(Prisma.sql`
    SELECT
      si."entityId",
      GREATEST(
        ts_rank_cd(
          to_tsvector('simple', coalesce(si."title", '') || ' ' || coalesce(si."searchText", '')),
          plainto_tsquery('simple', ${query})
        ),
        similarity(si."title", ${query}),
        similarity(si."searchText", ${query})
      ) as rank
    FROM "SearchIndex" si
    WHERE (
      to_tsvector('simple', coalesce(si."title", '') || ' ' || coalesce(si."searchText", ''))
        @@ plainto_tsquery('simple', ${query})
      OR si."title" % ${query}
      OR si."searchText" % ${query}
      OR si."title" ILIKE ${`%${query}%`}
      OR si."searchText" ILIKE ${`%${query}%`}
    )
    ${type ? Prisma.sql`AND si."entityType" = ${type}::"EntityType"` : Prisma.empty}
    ORDER BY rank DESC, si."updatedAt" DESC
    LIMIT 30
  `);

  if (rankedRows.length === 0) {
    return [];
  }

  const orderedIds = rankedRows.map((row) => row.entityId);
  const searchRows = await prisma.searchIndex.findMany({
    where: { entityId: { in: orderedIds } },
    select: {
      entityId: true,
      entityType: true,
      title: true,
      entity: {
        select: { slug: true }
      }
    }
  });

  const byId = new Map(searchRows.map((row) => [row.entityId, row]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      id: row.entityId,
      slug: row.entity.slug,
      title: row.title,
      entityType: row.entityType
    }));
}

/**
 * 读取最近实体修订记录，供首页和后台审计区域展示。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 *
 * 输出：
 * - 返回最近 20 条 revision 的轻量摘要。
 */
export async function getRecentChanges(prisma: PrismaService) {
  const revisions = await prisma.entityRevision.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      editor: true
    }
  });

  return revisions.map((revision) => ({
    id: revision.id,
    entityId: revision.entityId,
    revisionNo: revision.revisionNo,
    reviewStatus: revision.reviewStatus,
    editorName: revision.editor.displayName,
    editSummary: revision.editSummary,
    createdAt: revision.createdAt.toISOString()
  }));
}

/**
 * 获取待审核提案列表。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 *
 * 输出：
 * - 返回提案元数据、提案人信息以及被编辑实体的基础信息。
 */
export async function getModerationQueue(prisma: PrismaService) {
  const proposals = await prisma.editProposal.findMany({
    where: { status: ProposalStatus.pending },
    orderBy: { createdAt: "desc" },
    include: {
      proposer: true,
      entity: {
        include: {
          content: true,
          work: true,
          person: true,
          troupe: true,
          venue: true
        }
      }
    }
  });

  return proposals.map((proposal) => ({
    id: proposal.id,
    entityId: proposal.entityId,
    proposalType: proposal.proposalType,
    payloadJson: proposal.payloadJson,
    status: proposal.status,
    reviewComment: proposal.reviewComment,
    createdAt: proposal.createdAt.toISOString(),
    proposer: {
      id: proposal.proposer.id,
      username: proposal.proposer.username,
      displayName: proposal.proposer.displayName,
      roles: proposal.proposer.roles
    },
    entity: {
      id: proposal.entity.id,
      entityType: proposal.entity.entityType,
      slug: proposal.entity.slug,
      title: proposal.entity.title
    }
  }));
}

/**
 * 统计站点级别的核心数量指标和热门内容排行。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 *
 * 输出：
 * - 返回总量统计、热门剧目和热门城市数据。
 */
export async function getStats(prisma: PrismaService) {
  const [totalPublishedEntries, totalWorks, totalPeople, totalTroupes, totalUpcomingEvents, totalHistoricalEvents, workAggregation, cityAggregation] =
    await Promise.all([
      prisma.entity.count({ where: { status: PublishStatus.published } }),
      prisma.entity.count({ where: { entityType: "work" } }),
      prisma.entity.count({ where: { entityType: "person" } }),
      prisma.entity.count({ where: { entityType: "troupe" } }),
      prisma.event.count({ where: { businessStatus: { in: [EventStatus.announced, EventStatus.scheduled] } } }),
      prisma.event.count({ where: { businessStatus: EventStatus.completed } }),
      prisma.eventProgramItem.groupBy({
        by: ["workEntityId"],
        _count: { _all: true }
      }),
      prisma.event.findMany({
        select: {
          venue: {
            select: {
              cityText: true,
              cityRecord: {
                select: {
                  entity: {
                    select: {
                      title: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    ]);

  return {
    totalPublishedEntries,
    totalUpcomingEvents,
    totalHistoricalEvents,
    totalWorks,
    totalPeople,
    totalTroupes,
    topWorks: await buildTopWorks(prisma, workAggregation),
    topCities: buildTopCities(cityAggregation)
  };
}

/**
 * 获取后台首页概览信息。
 *
 * 输入：
 * - `prisma`: 主 Prisma service。
 *
 * 输出：
 * - 返回待审核提案数、用户数、最近审计日志和最近修订列表。
 */
export async function getAdminOverview(prisma: PrismaService) {
  const [pendingProposals, totalUsers, recentAuditLogs, recentRevisions] = await Promise.all([
    prisma.editProposal.count({ where: { status: ProposalStatus.pending } }),
    prisma.user.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: true }
    }),
    prisma.entityRevision.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { editor: true }
    })
  ]);

  return {
    pendingProposals,
    totalUsers,
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log.id,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      actor: log.actor.displayName,
      createdAt: log.createdAt.toISOString()
    })),
    recentRevisions: recentRevisions.map((revision) => ({
      id: revision.id,
      entityId: revision.entityId,
      revisionNo: revision.revisionNo,
      editSummary: revision.editSummary,
      editor: revision.editor.displayName,
      createdAt: revision.createdAt.toISOString()
    }))
  };
}
