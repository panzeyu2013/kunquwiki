import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, EventStatus, Prisma, PrismaClient, ProposalStatus, PublishStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { SearchIndexService } from "./search-index.service";

const entityInclude = {
  aliases: true,
  content: true,
  work: true,
  person: {
    include: {
      identities: true,
      troupeMemberships: true,
      birthCity: {
        include: {
          entity: true
        }
      }
    }
  },
  troupe: {
    include: {
      cityRecord: {
        include: {
          entity: true
        }
      }
    }
  },
  venue: {
    include: {
      cityRecord: {
        include: {
          entity: true
        }
      }
    }
  },
  event: {
    include: {
      city: {
        include: {
          entity: true
        }
      },
      troupes: {
        include: {
          troupe: {
            include: {
              entity: true
            }
          }
        },
        orderBy: { sortOrder: "asc" }
      },
      programItems: {
        include: {
          work: {
            include: {
              entity: true
            }
          },
          casts: true
        },
        orderBy: { sequenceNo: "asc" }
      },
      participants: {
        include: {
          person: {
            include: {
              entity: true
            }
          }
        },
        orderBy: { sortOrder: "asc" }
      }
    }
  },
  city: true,
  article: true,
  sourceRefs: {
    include: {
      source: true
    },
    orderBy: { sortOrder: "asc" }
  },
  outgoingRelations: true
} satisfies Prisma.EntityInclude;

type FullEntity = Prisma.EntityGetPayload<{ include: typeof entityInclude }>;
type OptionItem = { id: string; slug: string; title: string };

@Injectable()
export class ContentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService
  ) {}

  async getHomePayload() {
    const featuredEvents = await this.prisma.entity.findMany({
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

    const featuredWorks = await this.prisma.entity.findMany({
      where: {
        entityType: "work",
        status: PublishStatus.published
      },
      include: entityInclude,
      take: 3
    });

    const featuredPeople = await this.prisma.entity.findMany({
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
      featuredEvents: featuredEvents.map((item) => this.mapEntity(item)),
      featuredWorks: featuredWorks.map((item) => this.mapEntity(item)),
      featuredPeople: featuredPeople.map((item) => this.mapEntity(item)),
      recentChanges: await this.getRecentChanges(),
      stats: await this.getStats()
    };
  }

  async listEntities(params?: {
    type?: string;
    q?: string;
    city?: string;
    status?: string;
    troupe?: string;
    person?: string;
    work?: string;
    venue?: string;
  }) {
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
                              city: {
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
    const entities = await this.prisma.entity.findMany({
      where,
      include: entityInclude,
      orderBy: { updatedAt: "desc" }
    });

    return entities.map((item) => this.mapEntity(item));
  }

  async getEntityBySlug(slug: string) {
    const normalizedSlug = this.normalizeSlugInput(slug);
    const entity = await this.prisma.entity.findUnique({
      where: { slug: normalizedSlug },
      include: entityInclude
    });

    if (!entity) {
      throw new NotFoundException(`Entity ${normalizedSlug} not found`);
    }

    const mapped = this.mapEntity(entity);
    return {
      ...mapped,
      relatedEntities: await this.getRelatedEntities(entity),
      upcomingEvents: await this.getEntityEventRecords(entity, "upcoming"),
      pastEvents: await this.getEntityEventRecords(entity, "past")
    };
  }

  async search(query: string, type?: string) {
    if (!query.trim()) {
      const rows = await this.prisma.searchIndex.findMany({
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
      return Promise.all(baseRows.map(async (row) => {
        const entity = await this.prisma.entity.findUnique({ where: { id: row.id } });
        return { ...row, slug: entity?.slug ?? "" };
      }));
    }

    const rankedRows = await this.prisma.$queryRaw<Array<{
      entityId: string;
      rank: number;
    }>>(Prisma.sql`
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
    const searchRows = await this.prisma.searchIndex.findMany({
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

  async getRecentChanges() {
    const revisions = await this.prisma.entityRevision.findMany({
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

  async getModerationQueue() {
    const proposals = await this.prisma.editProposal.findMany({
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

  async getStats() {
    const [totalPublishedEntries, totalWorks, totalPeople, totalTroupes, totalUpcomingEvents, totalHistoricalEvents, workAggregation, cityAggregation] =
      await Promise.all([
        this.prisma.entity.count({ where: { status: PublishStatus.published } }),
        this.prisma.entity.count({ where: { entityType: "work" } }),
        this.prisma.entity.count({ where: { entityType: "person" } }),
        this.prisma.entity.count({ where: { entityType: "troupe" } }),
        this.prisma.event.count({ where: { businessStatus: { in: [EventStatus.announced, EventStatus.scheduled] } } }),
        this.prisma.event.count({ where: { businessStatus: EventStatus.completed } }),
        this.prisma.eventProgramItem.groupBy({
          by: ["workEntityId"],
          _count: true
        }),
        this.prisma.event.findMany({
          select: {
            venue: {
              select: {
                city: true
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
      topWorks: await this.buildTopWorks(workAggregation),
      topCities: this.buildTopCities(cityAggregation)
    };
  }

  async getAdminOverview() {
    const [pendingProposals, totalUsers, recentAuditLogs, recentRevisions] = await Promise.all([
      this.prisma.editProposal.count({ where: { status: ProposalStatus.pending } }),
      this.prisma.user.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: true }
      }),
      this.prisma.entityRevision.findMany({
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

  async createProposal(slug: string, proposerId: string, payload: { proposalType: string; editSummary: string; payload: Record<string, unknown> }) {
    const normalizedSlug = this.normalizeSlugInput(slug);
    const entity = await this.prisma.entity.findUnique({ where: { slug: normalizedSlug } });
    if (!entity) {
      throw new NotFoundException(`Entity ${normalizedSlug} not found`);
    }

    const normalizedEditSummary = await this.buildDefaultEditSummary(proposerId, payload.editSummary);

    const proposal = await this.prisma.editProposal.create({
      data: {
        entityId: entity.id,
        proposerId,
        proposalType: payload.proposalType,
        payloadJson: {
          editSummary: normalizedEditSummary,
          ...payload.payload
        } as Prisma.InputJsonValue
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: proposerId,
        actionType: "proposal.create",
        targetType: entity.entityType,
        targetId: entity.id,
        payloadJson: payload.payload as Prisma.InputJsonValue
      }
    });

    return proposal;
  }

  async reviewProposal(id: string, reviewerId: string, decision: "approved" | "rejected", reviewComment?: string) {
    const proposal = await this.prisma.editProposal.findUnique({
      where: { id },
      include: {
        entity: {
          include: entityInclude
        }
      }
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.editProposal.update({
        where: { id },
        data: {
          status: decision === "approved" ? ProposalStatus.approved : ProposalStatus.rejected,
          reviewerId,
          reviewedAt: new Date(),
          reviewComment
        }
      });

      if (decision === "approved") {
        const payload = proposal.payloadJson as Record<string, unknown>;
        const currentContent = await tx.entityContent.findUnique({
          where: { entityId: proposal.entityId }
        });

        const nextRevisionNo =
          ((await tx.entityRevision.aggregate({
            where: { entityId: proposal.entityId },
            _max: { revisionNo: true }
          }))._max.revisionNo ?? 0) + 1;

        const nextTitle =
          typeof payload.title === "string"
            ? await this.ensureStoredEntityTitle(tx, proposal.entity.entityType, payload.title, proposal.entityId)
            : proposal.entity.title;
        const nextSlug = proposal.entity.slug;

        await tx.entity.update({
          where: { id: proposal.entityId },
          data: {
            slug: nextSlug,
            title: nextTitle,
            updatedById: reviewerId,
            status: PublishStatus.published
          }
        });

        if (proposal.entity.entityType === "event") {
          await tx.event.update({
            where: { entityId: proposal.entityId },
            data: {
              lastVerifiedAt: new Date()
            }
          });
        }

        if (typeof payload.bodyMarkdown === "string") {
          await tx.entityContent.upsert({
            where: { entityId: proposal.entityId },
            update: {
              bodyMarkdown: payload.bodyMarkdown
            },
            create: {
              entityId: proposal.entityId,
              bodyMarkdown: payload.bodyMarkdown
            }
          });
        } else if (!currentContent) {
          await tx.entityContent.create({
            data: {
              entityId: proposal.entityId,
              bodyMarkdown: "待补充"
            }
          });
        }

        await this.applyStructuredProposal(tx, proposal.entity.entityType, proposal.entityId, payload);

        await tx.entityRevision.create({
          data: {
            entityId: proposal.entityId,
            revisionNo: nextRevisionNo,
            title: nextTitle,
            bodyMarkdown: typeof payload.bodyMarkdown === "string" ? payload.bodyMarkdown : currentContent?.bodyMarkdown,
            structuredDataJson: payload as Prisma.InputJsonValue,
            editSummary: typeof payload.editSummary === "string" ? payload.editSummary : "审核通过并写回条目",
            reviewStatus: "approved",
            editorId: proposal.proposerId,
            reviewerId,
            reviewedAt: new Date()
          }
        });

        await tx.user.update({
          where: { id: proposal.proposerId },
          data: {
            reputation: { increment: 1 }
          }
        });

        await this.searchIndex.rebuildEntity(proposal.entityId, tx);
      }

      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          actionType: `proposal.${decision}`,
          targetType: proposal.entity.entityType,
          targetId: proposal.entityId,
          payloadJson: {
            proposalId: proposal.id,
            reviewComment
          }
        }
      });

      return updatedProposal;
    });
  }

  async getEditorOptions(entityType?: string, excludeEntityId?: string) {
    const [works, people, troupes, venues, cities, roleEntities] = await Promise.all([
      this.listEntityOptions("work", excludeEntityId),
      this.listEntityOptions("person"),
      this.listEntityOptions("troupe"),
      this.listEntityOptions("venue"),
      this.listEntityOptions("city"),
      this.listEntityOptions("role")
    ]);

    const [fullWorks, excerpts] = await Promise.all([
      this.listEntityOptions("work", excludeEntityId, { work: { workType: "full_play" } }),
      this.listEntityOptions("work", excludeEntityId, { work: { workType: "excerpt" } })
    ]);

    return {
      entityType,
      identityOptions: ["演员", "教师", "导演", "编剧", "研究者", "推广者"],
      workTypeOptions: ["full_play", "excerpt", "adapted_piece"],
      troupeTypeOptions: ["troupe", "school", "research_org", "theater_org"],
      articleTypeOptions: ["term", "costume", "music", "history", "technique"],
      eventTypeOptions: ["performance", "festival", "lecture", "memorial"],
      eventStatusOptions: ["announced", "scheduled", "completed", "cancelled", "postponed"],
      works,
      fullWorks,
      excerpts,
      people,
      troupes,
      venues,
      cities,
      roleEntities
    };
  }

  private async buildTopWorks(workAggregation: Array<{ workEntityId: string | null; _count: number }>) {
    const countsById = new Map(
      workAggregation
        .filter((item): item is { workEntityId: string; _count: number } => Boolean(item.workEntityId))
        .map((item) => [item.workEntityId, item._count])
    );

    if (countsById.size === 0) {
      return [];
    }

    const works = await this.prisma.entity.findMany({
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

  private buildTopCities(cityAggregation: Array<{ venue: { city: string } | null }>) {
    const cityCounts = new Map<string, number>();
    for (const event of cityAggregation) {
      if (!event.venue?.city) {
        continue;
      }

      cityCounts.set(event.venue.city, (cityCounts.get(event.venue.city) ?? 0) + 1);
    }

    return [...cityCounts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  }

  private listEntityOptions(entityType: EntityType, excludeEntityId?: string, extraWhere?: Prisma.EntityWhereInput) {
    return this.prisma.entity.findMany({
      where: {
        entityType,
        ...(excludeEntityId ? { id: { not: excludeEntityId } } : {}),
        ...extraWhere
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        slug: true,
        title: true
      }
    }) as Promise<OptionItem[]>;
  }

  async createQuickEntity(
      input: {
      entityType: EntityType;
      title: string;
      workType?: string;
      parentWorkId?: string;
      initialData?: Record<string, unknown>;
    },
    createdById: string
  ) {
    const trimmedTitle = input.title.trim();
    const normalizedType = input.entityType;
    let finalTitle = trimmedTitle;
    let workType = input.workType;

    if (normalizedType === "work" && input.workType === "excerpt") {
      if (!input.parentWorkId) {
        throw new NotFoundException("折子戏需要先选择所属剧目");
      }
      const parent = await this.prisma.entity.findUnique({
        where: { id: input.parentWorkId }
      });
      if (!parent) {
        throw new NotFoundException("所属剧目不存在");
      }
      finalTitle = `${parent.title}·${trimmedTitle}`;
      workType = "excerpt";
    }

    if (normalizedType !== "event") {
      const existing = await this.prisma.entity.findFirst({
        where: {
          entityType: normalizedType,
          title: finalTitle
        },
        select: { id: true, slug: true, title: true }
      });

      if (existing) {
        return existing;
      }
    }

    const initialData = input.initialData ?? {};
    const explicitBodyMarkdown =
      Object.prototype.hasOwnProperty.call(initialData, "bodyMarkdown") && typeof initialData.bodyMarkdown === "string"
        ? initialData.bodyMarkdown
        : null;
    const bodyMarkdown =
      explicitBodyMarkdown ??
      (normalizedType !== "event" && typeof initialData.description === "string" && initialData.description.trim().length > 0
        ? initialData.description
        : "待补充");
    const initialStartAt =
      typeof initialData.startAt === "string" && initialData.startAt.length > 0 ? new Date(initialData.startAt) : new Date();
    const initialEventType = typeof initialData.eventType === "string" && initialData.eventType.length > 0 ? initialData.eventType : "performance";
    const initialEventStatus =
      typeof initialData.businessStatus === "string" && initialData.businessStatus.length > 0 ? initialData.businessStatus : EventStatus.scheduled;
    const initialTroupeIds = Array.isArray(initialData.troupeIds)
      ? this.toStringArray(initialData.troupeIds)
      : typeof initialData.troupeId === "string" && initialData.troupeId.length > 0
        ? [initialData.troupeId]
        : [];
    const slug =
      normalizedType === "event"
        ? await this.generateUniqueEventSlug(this.prisma, {
            startAt: initialStartAt,
            troupeEntityId: initialTroupeIds[0] ?? null,
            title: finalTitle
          })
        : await this.generateUniqueSlug(finalTitle);

    const entity = await this.prisma.entity.create({
      data: {
        entityType: normalizedType,
        slug,
        title: finalTitle,
        status: PublishStatus.draft,
        visibility: "public",
        createdById,
        updatedById: createdById,
        content: {
          create: {
            bodyMarkdown
          }
        },
        ...(normalizedType === "city"
          ? {
              city: {
                create: {
                  province: this.toNullableString(initialData.province) ?? "待补充"
                }
              }
            }
          : {}),
        ...(normalizedType === "troupe"
          ? {
              troupe: {
                create: {
                  troupeType: this.toNullableString(initialData.troupeType) ?? "troupe",
                  foundedDate: this.toNullableDate(initialData.foundedDate),
                  dissolvedDate: this.toNullableDate(initialData.dissolvedDate),
                  cityEntityId: this.toNullableString(initialData.cityId),
                  city: this.toNullableString(initialData.city) ?? "",
                  region: this.toNullableString(initialData.region) ?? "",
                  description: this.toNullableString(initialData.description) ?? bodyMarkdown,
                  officialWebsite: this.toNullableString(initialData.officialWebsite)
                }
              }
            }
          : {}),
        ...(normalizedType === "venue"
          ? {
              venue: {
                create: {
                  venueType: this.toNullableString(initialData.venueType) ?? "theater",
                  country: this.toNullableString(initialData.country) ?? "中国",
                  cityEntityId: this.toNullableString(initialData.cityId),
                  region: this.toNullableString(initialData.region) ?? "",
                  city: this.toNullableString(initialData.city) ?? "",
                  address: this.toNullableString(initialData.address) ?? "",
                  latitude: this.toNullableDecimal(initialData.latitude),
                  longitude: this.toNullableDecimal(initialData.longitude),
                  capacity: this.toNullableInt(initialData.capacity),
                  description: this.toNullableString(initialData.description) ?? bodyMarkdown
                }
              }
            }
          : {}),
        ...(normalizedType === "person"
          ? {
              person: {
                create: {
                  personTypeNote: this.toNullableString(initialData.personTypeNote),
                  gender: this.toNullableString(initialData.gender),
                  birthDate: this.toNullableDate(initialData.birthDate),
                  deathDate: this.toNullableDate(initialData.deathDate),
                  hometown: this.toNullableString(initialData.hometown),
                  birthCityEntityId: this.toNullableString(initialData.birthCityId),
                  bio: this.toNullableString(initialData.bio) ?? bodyMarkdown,
                  isLiving: typeof initialData.isLiving === "boolean" ? initialData.isLiving : true,
                  identities: {
                    create: this.toPersonIdentities(this.toObjectArray(initialData.personIdentities))
                  },
                  troupeMemberships: {
                    create: this.toTroupeMemberships(this.toObjectArray(initialData.troupeMemberships))
                  }
                }
              }
            }
          : {}),
        ...(normalizedType === "article"
          ? {
              article: {
                create: {
                  articleType: this.toNullableString(initialData.articleType) ?? "term",
                  abstract: this.toNullableString(initialData.abstract) ?? this.excerptText(bodyMarkdown),
                  difficultyLevel: this.toNullableString(initialData.difficultyLevel),
                  bodySourceType: this.toNullableString(initialData.bodySourceType)
                }
              }
            }
          : {}),
        ...(normalizedType === "role"
          ? {
              roleRecord: {
                create: {
                  workEntityId: this.toNullableString(initialData.workEntityId),
                  roleCategory: this.toNullableString(initialData.roleCategory),
                  description: this.toNullableString(initialData.description) ?? bodyMarkdown
                }
              }
            }
          : {}),
        ...(normalizedType === "work"
          ? {
              work: {
                create: {
                  workType: workType ?? "full_play",
                  parentWorkId: input.parentWorkId ?? null,
                  originalAuthor: this.toNullableString(initialData.originalAuthor),
                  dynastyPeriod: this.toNullableString(initialData.dynastyPeriod),
                  genreNote: this.toNullableString(initialData.genreNote),
                  synopsis: this.toNullableString(initialData.synopsis) ?? this.excerptText(bodyMarkdown),
                  plot: this.toNullableString(initialData.plot) ?? bodyMarkdown,
                  durationMinutes: this.toNullableInt(initialData.durationMinutes),
                  firstKnownDate: this.toNullableString(initialData.firstKnownDate),
                }
              }
            }
          : {}),
        ...(normalizedType === "event"
          ? {
              event: {
                create: {
                  eventType: initialEventType,
                  businessStatus: initialEventStatus as EventStatus,
                  startAt: initialStartAt,
                  endAt:
                    typeof initialData.endAt === "string" && initialData.endAt.length > 0 ? new Date(initialData.endAt) : null,
                  cityEntityId:
                    typeof initialData.cityId === "string" && initialData.cityId.length > 0 ? initialData.cityId : null,
                  venueEntityId:
                    typeof initialData.venueEntityId === "string" && initialData.venueEntityId.length > 0
                      ? initialData.venueEntityId
                      : null,
                  ticketUrl:
                    typeof initialData.ticketUrl === "string" && initialData.ticketUrl.length > 0 ? initialData.ticketUrl : null,
                  durationText:
                    typeof initialData.duration === "string" && initialData.duration.length > 0
                      ? initialData.duration
                      : typeof initialData.durationText === "string" && initialData.durationText.length > 0
                        ? initialData.durationText
                        : null,
                  ticketStatus:
                    typeof initialData.ticketStatus === "string" && initialData.ticketStatus.length > 0 ? initialData.ticketStatus : null,
                  noteText:
                    typeof initialData.noteText === "string" && initialData.noteText.length > 0 ? initialData.noteText : null,
                  posterImageId: this.toNullableString(initialData.posterImageId)
                }
              }
            }
          : {})
      },
      select: {
        id: true,
        slug: true,
        title: true
      }
    });

    await this.prisma.$transaction(async (tx) => {
      await this.applyStructuredProposal(tx, normalizedType, entity.id, initialData);
      if (Array.isArray(initialData.representativeWorkIds)) {
        await this.replaceEntityRelations(tx, entity.id, "rep_work", this.toStringArray(initialData.representativeWorkIds));
      }
      if (Array.isArray(initialData.representativeExcerptIds)) {
        await this.replaceEntityRelations(tx, entity.id, "rep_excerpt", this.toStringArray(initialData.representativeExcerptIds));
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: createdById,
        actionType: "entity.quick_create",
        targetType: normalizedType,
        targetId: entity.id,
        payloadJson: {
          title: finalTitle,
          workType: workType ?? null,
          parentWorkId: input.parentWorkId ?? null
        }
      }
    });

    await this.searchIndex.rebuildEntity(entity.id);
    return entity;
  }

  async findEntityByTypeAndTitle(entityType: EntityType, title: string) {
    return this.prisma.entity.findFirst({
      where: {
        entityType,
        title
      },
      select: {
        id: true,
        slug: true,
        title: true
      }
    });
  }

  private async ensureStoredEntityTitle(
    db: Prisma.TransactionClient | PrismaClient,
    entityType: EntityType,
    baseTitle: string,
    excludeEntityId?: string
  ) {
    const existing = await db.entity.findFirst({
      where: {
        entityType,
        title: baseTitle,
        ...(excludeEntityId ? { id: { not: excludeEntityId } } : {})
      },
      select: { id: true, title: true }
    });

    if (existing) {
      throw new ConflictException(`已存在同名${entityType === "work" ? "剧目" : "条目"}，请修改标题后再提交`);
    }

    return baseTitle;
  }

  private async getRelatedEntities(entity: FullEntity) {
    const candidates = new Map<string, { id: string; slug: string; title: string; entityType: string }>();

    if (entity.entityType === "event") {
      if (entity.event?.cityEntityId) {
        await this.collectEntityCandidate(entity.event.cityEntityId, candidates);
      }
      for (const troupeLink of entity.event?.troupes ?? []) {
        await this.collectEntityCandidate(troupeLink.troupeEntityId, candidates);
      }
      for (const item of entity.event?.programItems ?? []) {
        if (item.workEntityId) {
          await this.collectEntityCandidate(item.workEntityId, candidates);
        }
        for (const cast of item.casts ?? []) {
          if (cast.roleEntityId) {
            await this.collectEntityCandidate(cast.roleEntityId, candidates);
          }
          if (cast.personEntityId) {
            await this.collectEntityCandidate(cast.personEntityId, candidates);
          }
        }
      }
      if (entity.event?.venueEntityId) {
        await this.collectEntityCandidate(entity.event.venueEntityId, candidates);
      }
    }

    if (entity.entityType === "work") {
      if (entity.work?.parentWorkId) {
        await this.collectEntityCandidate(entity.work.parentWorkId, candidates);
      }
      const childWorks = await this.prisma.work.findMany({
        where: { parentWorkId: entity.id },
        take: 5
      });
      for (const child of childWorks) {
        await this.collectEntityCandidate(child.entityId, candidates);
      }
      const relatedEvents = await this.prisma.eventProgramItem.findMany({
        where: { workEntityId: entity.id },
        take: 5,
        orderBy: { sequenceNo: "asc" }
      });
      for (const item of relatedEvents) {
        await this.collectEntityCandidate(item.eventEntityId, candidates);
      }
    }

    if (entity.entityType === "person") {
      if (entity.person?.birthCityEntityId) {
        await this.collectEntityCandidate(entity.person.birthCityEntityId, candidates);
      }
      for (const membership of entity.person?.troupeMemberships ?? []) {
        await this.collectEntityCandidate(membership.troupeEntityId, candidates);
      }
      for (const relation of entity.outgoingRelations.filter((item) => ["rep_work", "rep_excerpt"].includes(item.relationType))) {
        await this.collectEntityCandidate(relation.toEntityId, candidates);
      }
      const relatedEvents = await this.prisma.performanceCast.findMany({
        where: { personEntityId: entity.id },
        take: 5,
        include: {
          programItem: true
        }
      });
      for (const cast of relatedEvents) {
        await this.collectEntityCandidate(cast.programItem.eventEntityId, candidates);
      }
      const participantEvents = await this.prisma.eventParticipant.findMany({
        where: { personEntityId: entity.id },
        take: 5
      });
      for (const participant of participantEvents) {
        await this.collectEntityCandidate(participant.eventEntityId, candidates);
      }
    }

    if (entity.entityType === "troupe") {
      if (entity.troupe?.cityEntityId) {
        await this.collectEntityCandidate(entity.troupe.cityEntityId, candidates);
      }
      const members = await this.prisma.personTroupeMembership.findMany({
        where: { troupeEntityId: entity.id },
        take: 5
      });
      for (const member of members) {
        await this.collectEntityCandidate(member.personEntityId, candidates);
      }
      const events = await this.prisma.eventTroupe.findMany({
        where: { troupeEntityId: entity.id },
        take: 5
      });
      for (const event of events) {
        await this.collectEntityCandidate(event.eventEntityId, candidates);
      }
    }

    if (entity.entityType === "venue") {
      if (entity.venue?.cityEntityId) {
        await this.collectEntityCandidate(entity.venue.cityEntityId, candidates);
      }
      const events = await this.prisma.event.findMany({
        where: { venueEntityId: entity.id },
        take: 5,
        orderBy: { startAt: "desc" }
      });
      for (const event of events) {
        await this.collectEntityCandidate(event.entityId, candidates);
      }
    }

    if (entity.entityType === "city") {
      const [venues, troupes] = await Promise.all([
        this.prisma.venue.findMany({ where: { cityEntityId: entity.id }, take: 5 }),
        this.prisma.troupe.findMany({ where: { cityEntityId: entity.id }, take: 5 })
      ]);
      for (const venue of venues) {
        await this.collectEntityCandidate(venue.entityId, candidates);
      }
      for (const troupe of troupes) {
        await this.collectEntityCandidate(troupe.entityId, candidates);
      }
    }

    return [...candidates.values()].slice(0, 6);
  }

  private async getEntityEventRecords(entity: FullEntity, mode: "upcoming" | "past") {
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

    const events = await this.prisma.event.findMany({
      where,
      include: {
        entity: true,
        city: { include: { entity: true } },
        venue: { include: { entity: true } },
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
        city: event.city?.entity.title ?? event.venue?.city ?? undefined,
        venue: event.venue?.entity.title ?? undefined,
        troupe: troupeNames.length > 0 ? troupeNames.join("、") : undefined
      };
    });
  }

  private async collectEntityCandidate(
    entityId: string,
    candidates: Map<string, { id: string; slug: string; title: string; entityType: string }>
  ) {
    if (candidates.has(entityId)) {
      return;
    }

    const entity = await this.prisma.entity.findUnique({
      where: { id: entityId },
      include: {
        content: true,
        work: true,
        person: true,
        troupe: true,
        venue: true
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

  private async applyStructuredProposal(
    tx: Prisma.TransactionClient,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ) {
    switch (entityType) {
      case "work":
        await tx.work.update({
          where: { entityId },
          data: {
            ...(typeof payload.workType === "string" ? { workType: payload.workType } : {}),
            ...(typeof payload.parentWorkId === "string" || payload.parentWorkId === null
              ? { parentWorkId: typeof payload.parentWorkId === "string" && payload.parentWorkId.length > 0 ? payload.parentWorkId : null }
              : {}),
            ...(typeof payload.originalAuthor === "string" ? { originalAuthor: payload.originalAuthor } : {}),
            ...(typeof payload.dynastyPeriod === "string" ? { dynastyPeriod: payload.dynastyPeriod } : {}),
            ...(typeof payload.genreNote === "string" ? { genreNote: payload.genreNote } : {}),
            ...(typeof payload.synopsis === "string" ? { synopsis: payload.synopsis } : {}),
            ...(typeof payload.plot === "string"
              ? { plot: payload.plot }
              : typeof payload.bodyMarkdown === "string"
                ? { plot: payload.bodyMarkdown }
                : {}),
            ...(typeof payload.durationMinutes === "number" ? { durationMinutes: payload.durationMinutes } : {}),
            ...(payload.durationMinutes === null ? { durationMinutes: null } : {}),
            ...(typeof payload.firstKnownDate === "string" ? { firstKnownDate: payload.firstKnownDate } : {}),
          }
        });
        break;
      case "person": {
        await tx.person.update({
          where: { entityId },
          data: {
            ...(typeof payload.personTypeNote === "string" ? { personTypeNote: payload.personTypeNote } : {}),
            ...(typeof payload.gender === "string" ? { gender: payload.gender } : {}),
            ...(typeof payload.birthDate === "string" ? { birthDate: new Date(payload.birthDate) } : {}),
            ...(payload.birthDate === null ? { birthDate: null } : {}),
            ...(typeof payload.deathDate === "string" ? { deathDate: new Date(payload.deathDate) } : {}),
            ...(payload.deathDate === null ? { deathDate: null } : {}),
            ...(typeof payload.hometown === "string" ? { hometown: payload.hometown } : {}),
            ...(typeof payload.birthCityId === "string" || payload.birthCityId === null
              ? { birthCityEntityId: typeof payload.birthCityId === "string" && payload.birthCityId.length > 0 ? payload.birthCityId : null }
              : {}),
            ...(typeof payload.bio === "string"
              ? { bio: payload.bio }
              : typeof payload.bodyMarkdown === "string"
                ? { bio: payload.bodyMarkdown }
                : {}),
            ...(typeof payload.isLiving === "boolean" ? { isLiving: payload.isLiving } : {})
          }
        });

        if (Array.isArray(payload.personIdentities)) {
          await tx.personIdentity.deleteMany({ where: { personEntityId: entityId } });
          const identities = this.toPersonIdentities(this.toObjectArray(payload.personIdentities));
          if (identities.length > 0) {
            await tx.personIdentity.createMany({
              data: identities.map((identity) => ({ ...identity, personEntityId: entityId }))
            });
          }
        } else if (Array.isArray(payload.identities)) {
          const identities = this.toStringArray(payload.identities);
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
          const memberships = this.toTroupeMemberships(this.toObjectArray(payload.troupeMemberships));
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
          const troupeIds = this.toStringArray(payload.troupeIds);
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

        if (Array.isArray(payload.representativeWorkIds)) {
          await this.replaceEntityRelations(tx, entityId, "rep_work", this.toStringArray(payload.representativeWorkIds));
        }

        if (Array.isArray(payload.representativeExcerptIds)) {
          await this.replaceEntityRelations(tx, entityId, "rep_excerpt", this.toStringArray(payload.representativeExcerptIds));
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
            ...(typeof payload.troupeType === "string" ? { troupeType: payload.troupeType } : {}),
            ...(typeof payload.foundedDate === "string" ? { foundedDate: new Date(payload.foundedDate) } : {}),
            ...(payload.foundedDate === null ? { foundedDate: null } : {}),
            ...(typeof payload.dissolvedDate === "string" ? { dissolvedDate: new Date(payload.dissolvedDate) } : {}),
            ...(payload.dissolvedDate === null ? { dissolvedDate: null } : {}),
            ...(typeof payload.cityId === "string" || payload.cityId === null
              ? { cityEntityId: typeof payload.cityId === "string" && payload.cityId.length > 0 ? payload.cityId : null }
              : {}),
            ...(typeof payload.city === "string" ? { city: payload.city } : {}),
            ...(typeof payload.region === "string" ? { region: payload.region } : {}),
            ...(typeof payload.description === "string"
              ? { description: payload.description }
              : typeof payload.bodyMarkdown === "string"
                ? { description: payload.bodyMarkdown }
                : {}),
            ...(typeof payload.officialWebsite === "string" ? { officialWebsite: payload.officialWebsite } : {})
          }
        });
        break;
      case "venue":
        await tx.venue.update({
          where: { entityId },
          data: {
            ...(typeof payload.venueType === "string" ? { venueType: payload.venueType } : {}),
            ...(typeof payload.country === "string" ? { country: payload.country } : {}),
            ...(typeof payload.cityId === "string" || payload.cityId === null
              ? { cityEntityId: typeof payload.cityId === "string" && payload.cityId.length > 0 ? payload.cityId : null }
              : {}),
            ...(typeof payload.city === "string" ? { city: payload.city } : {}),
            ...(typeof payload.region === "string" ? { region: payload.region } : {}),
            ...(typeof payload.address === "string" ? { address: payload.address } : {}),
            ...(typeof payload.latitude === "number" ? { latitude: payload.latitude } : {}),
            ...(payload.latitude === null ? { latitude: null } : {}),
            ...(typeof payload.longitude === "number" ? { longitude: payload.longitude } : {}),
            ...(payload.longitude === null ? { longitude: null } : {}),
            ...(typeof payload.capacity === "number" ? { capacity: payload.capacity } : {}),
            ...(payload.capacity === null ? { capacity: null } : {}),
            ...(typeof payload.description === "string"
              ? { description: payload.description }
              : typeof payload.bodyMarkdown === "string"
                ? { description: payload.bodyMarkdown }
                : {})
          }
        });
        break;
      case "event": {
        await tx.event.update({
          where: { entityId },
          data: {
            ...(typeof payload.eventType === "string" ? { eventType: payload.eventType } : {}),
            ...(typeof payload.businessStatus === "string" ? { businessStatus: payload.businessStatus as EventStatus } : {}),
            ...(typeof payload.startAt === "string" ? { startAt: new Date(payload.startAt) } : {}),
            ...(typeof payload.endAt === "string" ? { endAt: new Date(payload.endAt) } : {}),
            ...(payload.endAt === null ? { endAt: null } : {}),
            ...(typeof payload.cityId === "string" || payload.cityId === null
              ? { cityEntityId: typeof payload.cityId === "string" && payload.cityId.length > 0 ? payload.cityId : null }
              : {}),
            ...(typeof payload.venueEntityId === "string" || payload.venueEntityId === null
              ? { venueEntityId: typeof payload.venueEntityId === "string" && payload.venueEntityId.length > 0 ? payload.venueEntityId : null }
              : {}),
            ...(typeof payload.ticketUrl === "string" ? { ticketUrl: payload.ticketUrl } : {}),
            ...(typeof payload.duration === "string" ? { durationText: payload.duration } : {}),
            ...(typeof payload.durationText === "string" ? { durationText: payload.durationText } : {}),
            ...(typeof payload.ticketStatus === "string" ? { ticketStatus: payload.ticketStatus } : {}),
            ...(typeof payload.noteText === "string" ? { noteText: payload.noteText } : {}),
            ...(typeof payload.posterImageId === "string" ? { posterImageId: payload.posterImageId } : {})
          }
        });

        if (Array.isArray(payload.troupeIds)) {
          await tx.eventTroupe.deleteMany({ where: { eventEntityId: entityId } });
          const troupeIds = this.toStringArray(payload.troupeIds);
          if (troupeIds.length > 0) {
            await tx.eventTroupe.createMany({
              data: troupeIds.map((troupeId, index) => ({
                eventEntityId: entityId,
                troupeEntityId: troupeId,
                sortOrder: index
              }))
            });
          }
        } else if (typeof payload.troupeId === "string" && payload.troupeId.length > 0) {
          await tx.eventTroupe.deleteMany({ where: { eventEntityId: entityId } });
          await tx.eventTroupe.create({
            data: {
              eventEntityId: entityId,
              troupeEntityId: payload.troupeId,
              sortOrder: 0
            }
          });
        }

        if (Array.isArray(payload.programDetailed)) {
          await tx.performanceCast.deleteMany({
            where: {
              programItem: {
                eventEntityId: entityId
              }
            }
          });
          await tx.eventProgramItem.deleteMany({ where: { eventEntityId: entityId } });
          const items = this.toEventProgramItems(this.toObjectArray(payload.programDetailed));
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
            const casts = this.toPerformanceCasts(item.casts);
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
        } else if (Array.isArray(payload.programWorkIds) || Array.isArray(payload.programExcerptIds)) {
          await tx.eventProgramItem.deleteMany({ where: { eventEntityId: entityId } });
          const workIds = Array.isArray(payload.programWorkIds) ? this.toStringArray(payload.programWorkIds) : [];
          const excerptIds = Array.isArray(payload.programExcerptIds) ? this.toStringArray(payload.programExcerptIds) : [];
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
            ...(typeof payload.articleType === "string" ? { articleType: payload.articleType } : {}),
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

  private async replaceEntityRelations(tx: Prisma.TransactionClient, fromEntityId: string, relationType: string, toEntityIds: string[]) {
    await tx.entityRelation.deleteMany({
      where: {
        fromEntityId,
        relationType
      }
    });
    if (toEntityIds.length > 0) {
      await tx.entityRelation.createMany({
        data: toEntityIds.map((toEntityId, index) => ({
          fromEntityId,
          toEntityId,
          relationType,
          sortOrder: index
        }))
      });
    }
  }

  private toStringArray(value: unknown[]) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  private normalizeSlugInput(slug: string) {
    const trimmed = slug.trim();
    return /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed;
  }

  private toNullableString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }

  private toNullableInt(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toNullableDecimal(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toNullableDate(value: unknown) {
    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toObjectArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  }

  private toPersonIdentities(items: Record<string, unknown>[]) {
    return items
      .map((item) => ({
        identityTerm: this.toNullableString(item.identityTerm),
        startDate: this.toNullableDate(item.startDate),
        endDate: this.toNullableDate(item.endDate)
      }))
      .filter((item): item is { identityTerm: string; startDate: Date | null; endDate: Date | null } => Boolean(item.identityTerm));
  }

  private toTroupeMemberships(items: Record<string, unknown>[]) {
    return items
      .map((item) => ({
        troupeEntityId: this.toNullableString(item.troupeEntityId),
        membershipRole: this.toNullableString(item.membershipRole) ?? "成员",
        startDate: this.toNullableDate(item.startDate),
        endDate: this.toNullableDate(item.endDate),
        isCurrent: typeof item.isCurrent === "boolean" ? item.isCurrent : false
      }))
      .filter(
        (item): item is {
          troupeEntityId: string;
          membershipRole: string;
          startDate: Date | null;
          endDate: Date | null;
          isCurrent: boolean;
        } => Boolean(item.troupeEntityId)
      );
  }

  private toPerformanceCasts(value: unknown) {
    return this.toObjectArray(value)
      .map((item) => ({
        roleEntityId: this.toNullableString(item.roleEntityId),
        personEntityId: this.toNullableString(item.personEntityId),
        castNote: this.toNullableString(item.castNote)
      }))
      .filter((item) => item.roleEntityId || item.personEntityId || item.castNote);
  }

  private toEventProgramItems(
    items: Record<string, unknown>[],
    fallback?: { fallbackWorkIds?: string[]; fallbackExcerptIds?: string[] }
  ) {
    if (items.length === 0) {
      const workIds = fallback?.fallbackWorkIds ?? [];
      const excerptIds = fallback?.fallbackExcerptIds ?? [];
      return [...workIds, ...excerptIds].map((workEntityId, index) => ({
        workEntityId,
        titleOverride: null,
        sequenceNo: index + 1,
        durationMinutes: null,
        notes: null,
        casts: []
      }));
    }
    return items
      .map((item, index) => ({
        workEntityId: this.toNullableString(item.workEntityId),
        titleOverride: this.toNullableString(item.titleOverride),
        sequenceNo: this.toNullableInt(item.sequenceNo) ?? index + 1,
        durationMinutes: this.toNullableInt(item.durationMinutes),
        notes: this.toNullableString(item.notes),
        casts: item.casts
      }))
      .filter((item) => item.workEntityId || item.titleOverride);
  }

  private async generateUniqueSlug(title: string) {
    const base = title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "entity";

    let candidate = base;
    let counter = 2;
    while (await this.prisma.entity.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  private async buildDefaultEditSummary(proposerId: string, editSummary?: string) {
    if (typeof editSummary === "string" && editSummary.trim().length > 0) {
      return editSummary.trim();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: proposerId },
      select: { displayName: true, username: true }
    });
    const signature = user?.displayName?.trim() || user?.username?.trim() || proposerId;
    const timestamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
    return `${signature} ${timestamp}`;
  }

  private async generateUniqueEventSlug(
    db: Prisma.TransactionClient | PrismaClient,
    input: { startAt: Date | null; troupeEntityId: string | null; title: string },
    excludeEntityId?: string
  ) {
    const dateLabel = input.startAt ? input.startAt.toISOString().slice(0, 10).replace(/-/g, "_") : "undated";
    const troupeTitle = input.troupeEntityId
      ? (
          await db.entity.findUnique({
            where: { id: input.troupeEntityId },
            select: { title: true }
          })
        )?.title ?? "unknown_troupe"
      : "unknown_troupe";

    const base = [dateLabel, troupeTitle, input.title]
      .map((item) =>
        item
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^\p{Letter}\p{Number}_]+/gu, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
      )
      .filter(Boolean)
      .join("_");

    let candidate = base || "event";
    let counter = 2;
    while (
      await db.entity.findFirst({
        where: {
          slug: candidate,
          ...(excludeEntityId ? { id: { not: excludeEntityId } } : {})
        },
        select: { id: true }
      })
    ) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }
    return candidate;
  }

  private mapEntity(entity: FullEntity) {
    const base = {
      id: entity.id,
      entityType: entity.entityType,
      slug: entity.slug,
      title: entity.title,
      subtitle: entity.subtitle ?? undefined,
      status: entity.status,
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
          workType: entity.work?.workType ?? "full_play",
          originalAuthor: entity.work?.originalAuthor ?? undefined,
          dynastyPeriod: entity.work?.dynastyPeriod ?? undefined,
          genreNote: entity.work?.genreNote ?? undefined,
          parentWorkId: entity.work?.parentWorkId ?? undefined,
          synopsis: entity.work?.synopsis ?? this.excerptText(entity.work?.plot ?? entity.content?.bodyMarkdown ?? "待补充"),
          plot: entity.work?.plot ?? entity.content?.bodyMarkdown ?? "待补充",
          durationMinutes: entity.work?.durationMinutes ?? undefined,
          firstKnownDate: entity.work?.firstKnownDate ?? undefined,
        };
      case "person":
        return {
          ...base,
          roles: entity.person?.identities.map((item) => item.identityTerm) ?? [],
          personTypeNote: entity.person?.personTypeNote ?? undefined,
          gender: entity.person?.gender ?? undefined,
          birthDate: entity.person?.birthDate?.toISOString(),
          deathDate: entity.person?.deathDate?.toISOString(),
          hometown: entity.person?.hometown ?? undefined,
          birthCityId: entity.person?.birthCityEntityId ?? undefined,
          isLiving: entity.person?.isLiving ?? true,
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
          city: entity.troupe?.city ?? "",
          region: entity.troupe?.region ?? "",
          troupeType: entity.troupe?.troupeType ?? "troupe",
          officialWebsite: entity.troupe?.officialWebsite ?? undefined,
          description: entity.troupe?.description ?? entity.content?.bodyMarkdown ?? "待补充"
        };
      case "venue":
        return {
          ...base,
          venueType: entity.venue?.venueType ?? "theater",
          country: entity.venue?.country ?? "中国",
          cityId: entity.venue?.cityEntityId ?? undefined,
          city: entity.venue?.city ?? "",
          region: entity.venue?.region ?? "",
          address: entity.venue?.address ?? "",
          latitude: entity.venue?.latitude ? Number(entity.venue.latitude) : undefined,
          longitude: entity.venue?.longitude ? Number(entity.venue.longitude) : undefined,
          capacity: entity.venue?.capacity ?? undefined,
          description: entity.venue?.description ?? entity.content?.bodyMarkdown ?? "待补充"
        };
      case "event":
        return {
          ...base,
          eventType: entity.event?.eventType ?? "performance",
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
          body: entity.content?.bodyMarkdown ?? "待补充",
          program: (entity.event?.programItems ?? []).map((item) => ({
            id: item.id,
            title: item.titleOverride ?? item.work?.entity.title ?? "未命名节目",
            workId: item.workEntityId ?? undefined,
            workType: item.work?.workType as "full_play" | "excerpt" | "adapted_piece" | undefined,
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
          articleType: entity.article?.articleType ?? "term",
          abstract: entity.article?.abstract ?? undefined,
          difficultyLevel: entity.article?.difficultyLevel ?? undefined,
          bodySourceType: entity.article?.bodySourceType ?? undefined,
          body: entity.content?.bodyMarkdown ?? "待补充"
        };
      default:
        return base;
    }
  }

  private stripMarkdown(value: string) {
    return value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/[*_~]/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private excerptText(value: string, limit = 120) {
    const plainText = this.stripMarkdown(value);
    if (plainText.length <= limit) {
      return plainText;
    }
    return `${plainText.slice(0, limit).trimEnd()}...`;
  }
}
