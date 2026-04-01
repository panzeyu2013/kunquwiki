import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "./prisma.service";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class SearchIndexService {
  constructor(private readonly prisma: PrismaService) {}

  async rebuildEntity(entityId: string, client?: PrismaLike) {
    const db = client ?? this.prisma;
    const entity = await db.entity.findUnique({
      where: { id: entityId },
      include: {
        sourceRefs: {
          include: {
            source: true
          }
        },
        content: true,
        person: {
          include: {
            birthCity: {
              include: {
                entity: true
              }
            },
            troupeMemberships: {
              include: {
                troupe: {
                  include: {
                    entity: true
                  }
                }
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
            venue: {
              include: {
                entity: true,
                cityRecord: {
                  include: {
                    entity: true
                  }
                }
              }
            },
            troupes: {
              include: {
                troupe: {
                  include: {
                    entity: true
                  }
                }
              }
            },
            programItems: {
              include: {
                work: {
                  include: {
                    entity: true
                  }
                },
                casts: {
                  include: {
                    person: {
                      include: {
                        entity: true
                      }
                    }
                  }
                }
              }
            },
            participants: {
              include: {
                person: {
                  include: {
                    entity: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!entity) {
      return null;
    }

    const sources = entity.sourceRefs.map((item) => item.source.title);
    const relatedTerms = [
      entity.person?.birthCity?.entity.title,
      ...(entity.person?.troupeMemberships.map((item) => item.troupe.entity.title) ?? []),
      entity.troupe?.cityRecord?.entity.title,
      entity.troupe?.cityText,
      entity.venue?.cityRecord?.entity.title,
      entity.venue?.cityText,
      entity.event?.city?.entity.title,
      entity.event?.venue?.entity.title,
      entity.event?.venue?.cityRecord?.entity.title,
      ...(entity.event?.troupes.map((item) => item.troupe?.entity.title).filter(Boolean) ?? []),
      ...(entity.event?.participants.map((item) => item.person?.entity.title).filter(Boolean) ?? []),
      ...(entity.event?.programItems.map((item) => item.work?.entity.title).filter(Boolean) ?? []),
      ...(entity.event?.programItems.flatMap((item) => item.casts.map((cast) => cast.person?.entity.title)).filter(Boolean) ?? [])
    ];
    const searchText = [entity.title, entity.subtitle, entity.content?.bodyMarkdown, ...sources, ...relatedTerms]
      .filter(Boolean)
      .join(" ");

    return db.searchIndex.upsert({
      where: { entityId },
      update: {
        entityType: entity.entityType,
        title: entity.title,
        searchText
      },
      create: {
        entityId,
        entityType: entity.entityType,
        title: entity.title,
        searchText
      }
    });
  }
}
