import { Prisma } from "@prisma/client";

export const entityInclude = {
  aliases: true,
  content: true,
  coverImage: true,
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
      posterImage: true,
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

export type FullEntity = Prisma.EntityGetPayload<{ include: typeof entityInclude }>;
export type OptionItem = { id: string; slug: string; title: string };
