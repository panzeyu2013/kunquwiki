import {
  EntityType,
  EventStatus,
  PrismaClient,
  ProposalStatus,
  PublishStatus,
  ReviewStatus,
  UserRole
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.discussionPost.deleteMany(),
    prisma.discussionThread.deleteMany(),
    prisma.performanceCast.deleteMany(),
    prisma.eventParticipant.deleteMany(),
    prisma.eventProgramItem.deleteMany(),
    prisma.eventSession.deleteMany(),
    prisma.personTroupeMembership.deleteMany(),
    prisma.personIdentity.deleteMany(),
    prisma.workRole.deleteMany(),
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
    prisma.lineage.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.entityAlias.deleteMany(),
    prisma.entity.deleteMany(),
    prisma.user.deleteMany()
  ]);

  const passwordHash = await bcrypt.hash("Kunquwiki123!", 10);

  const [admin, reviewer, editor, bot] = await Promise.all([
    prisma.user.create({
      data: {
        username: "admin",
        displayName: "站务管理员",
        email: "admin@kunquwiki.local",
        passwordHash,
        roles: [UserRole.admin, UserRole.reviewer, UserRole.editor]
      }
    }),
    prisma.user.create({
      data: {
        username: "reviewer",
        displayName: "内容审核员",
        email: "reviewer@kunquwiki.local",
        passwordHash,
        roles: [UserRole.reviewer, UserRole.editor]
      }
    }),
    prisma.user.create({
      data: {
        username: "editor",
        displayName: "示例编辑者",
        email: "editor@kunquwiki.local",
        passwordHash,
        roles: [UserRole.editor]
      }
    }),
    prisma.user.create({
      data: {
        username: "bot",
        displayName: "自动化机器人",
        email: "bot@kunquwiki.local",
        passwordHash,
        roles: ["bot" as UserRole, UserRole.editor]
      }
    })
  ]);

  await prisma.user.create({
    data: {
      username: "visitor",
      displayName: "测试访客",
      email: "visitor@kunquwiki.local",
      passwordHash,
      roles: [UserRole.visitor]
    }
  });

  const sourceMap = {
    museum: await prisma.source.create({
      data: {
        sourceType: "institution",
        title: "中国昆曲博物馆资料",
        publisher: "中国昆曲博物馆",
        reliabilityLevel: "official"
      }
    }),
    shkun: await prisma.source.create({
      data: {
        sourceType: "official",
        title: "上海昆剧团官方资料",
        publisher: "上海昆剧团",
        reliabilityLevel: "official"
      }
    }),
    sukun: await prisma.source.create({
      data: {
        sourceType: "official",
        title: "苏州昆剧院官方简介",
        publisher: "苏州昆剧院",
        reliabilityLevel: "official"
      }
    }),
    interview: await prisma.source.create({
      data: {
        sourceType: "media",
        title: "人物采访整理",
        publisher: "媒体公开报道",
        reliabilityLevel: "secondary"
      }
    }),
    lexicon: await prisma.source.create({
      data: {
        sourceType: "book",
        title: "戏曲术语辞典",
        publisher: "学术出版物",
        reliabilityLevel: "scholarly"
      }
    }),
    eventNotice: await prisma.source.create({
      data: {
        sourceType: "official",
        title: "演出官宣页面",
        publisher: "上海昆剧团",
        sourceUrl: "https://example.com/mudanting",
        reliabilityLevel: "official"
      }
    })
  };

  const cityShanghai = await createEntity({
    type: EntityType.city,
    slug: "上海",
    title: "上海",
    createdById: admin.id,
    updatedById: admin.id,
    content: "昆曲演出与院团活动最活跃的城市之一。",
    sourceIds: [sourceMap.museum.id],
    nested: {
      city: {
        create: {
          province: "上海市"
        }
      }
    }
  });

  const citySuzhou = await createEntity({
    type: EntityType.city,
    slug: "苏州",
    title: "苏州",
    createdById: admin.id,
    updatedById: admin.id,
    content: "昆曲发源地文化语境中的核心城市。",
    sourceIds: [sourceMap.museum.id],
    nested: {
      city: {
        create: {
          province: "江苏省"
        }
      }
    }
  });

  const cityBeijing = await createEntity({
    type: EntityType.city,
    slug: "北京",
    title: "北京",
    createdById: admin.id,
    updatedById: admin.id,
    content: "昆曲演出、讲座与交流活动的重要城市。",
    sourceIds: [sourceMap.lexicon.id],
    nested: {
      city: {
        create: {
          province: "北京市"
        }
      }
    }
  });

  const work1 = await createEntity({
    type: EntityType.work,
    slug: "牡丹亭",
    title: "牡丹亭",
    createdById: admin.id,
    updatedById: admin.id,
    content: "《牡丹亭》是昆曲最具代表性的作品之一。",
    sourceIds: [sourceMap.museum.id],
    nested: {
      work: {
        create: {
          workType: "full_play",
          originalAuthor: "汤显祖",
          dynastyPeriod: "明",
          synopsis: "以梦与情为线索展开的传奇作品。",
          plot: "杜丽娘游园惊梦，相思成疾，死后与柳梦梅因情复生。"
        }
      }
    }
  });

  const work2 = await createEntity({
    type: EntityType.work,
    slug: "牡丹亭-游园惊梦",
    title: "牡丹亭·游园惊梦",
    createdById: admin.id,
    updatedById: admin.id,
    content: "杜丽娘在春光中游园入梦。",
    sourceIds: [sourceMap.shkun.id],
    nested: {
      work: {
        create: {
          workType: "excerpt",
          parentWorkId: work1.id,
          originalAuthor: "汤显祖",
          dynastyPeriod: "明",
          synopsis: "杜丽娘在春光中游园入梦。",
          plot: "通过园林、青春与梦境，奠定全剧情感基调。"
        }
      }
    }
  });

  const work3 = await createEntity({
    type: EntityType.work,
    slug: "长生殿",
    title: "长生殿",
    createdById: admin.id,
    updatedById: admin.id,
    content: "通过帝妃悲剧映射王朝盛衰与人情变幻。",
    sourceIds: [sourceMap.museum.id],
    nested: {
      work: {
        create: {
          workType: "full_play",
          originalAuthor: "洪昇",
          dynastyPeriod: "清",
          synopsis: "以爱情与兴亡互相映照。",
          plot: "通过帝妃悲剧映射王朝盛衰与人情变幻。"
        }
      }
    }
  });

  const troupe1 = await createEntity({
    type: EntityType.troupe,
    slug: "上海昆剧团",
    title: "上海昆剧团",
    createdById: admin.id,
    updatedById: admin.id,
    content: "以上海为核心阵地，长期活跃于全国演出与传播。",
    sourceIds: [sourceMap.shkun.id],
    nested: {
      troupe: {
        create: {
          troupeType: "troupe",
          cityEntityId: cityShanghai.id,
          city: "上海",
          region: "上海",
          description: "以上海为核心阵地，长期活跃于全国演出与传播。"
        }
      }
    }
  });

  const troupe2 = await createEntity({
    type: EntityType.troupe,
    slug: "苏州昆剧院",
    title: "苏州昆剧院",
    createdById: admin.id,
    updatedById: admin.id,
    content: "围绕昆曲发源地文化语境开展演出、传承与传播。",
    sourceIds: [sourceMap.sukun.id],
    nested: {
      troupe: {
        create: {
          troupeType: "troupe",
          cityEntityId: citySuzhou.id,
          city: "苏州",
          region: "江苏",
          description: "围绕昆曲发源地文化语境开展演出、传承与传播。"
        }
      }
    }
  });

  const person1 = await createEntity({
    type: EntityType.person,
    slug: "张军",
    title: "张军",
    createdById: admin.id,
    updatedById: admin.id,
    content: "活跃于舞台演出、跨界合作与昆曲推广。",
    sourceIds: [sourceMap.interview.id],
    nested: {
      person: {
        create: {
          gender: "男",
          birthCityEntityId: cityShanghai.id,
          bio: "活跃于舞台演出、跨界合作与昆曲推广。"
        }
      }
    }
  });

  const person2 = await createEntity({
    type: EntityType.person,
    slug: "沈丰英",
    title: "沈丰英",
    createdById: admin.id,
    updatedById: admin.id,
    content: "长期从事舞台演出与人才培养。",
    sourceIds: [sourceMap.sukun.id],
    nested: {
      person: {
        create: {
          gender: "女",
          birthCityEntityId: citySuzhou.id,
          bio: "长期从事舞台演出与人才培养。"
        }
      }
    }
  });

  await prisma.personIdentity.createMany({
    data: [
      { personEntityId: person1.id, identityTerm: "演员" },
      { personEntityId: person1.id, identityTerm: "推广者" },
      { personEntityId: person2.id, identityTerm: "演员" },
      { personEntityId: person2.id, identityTerm: "教师" }
    ]
  });

  await prisma.personTroupeMembership.createMany({
    data: [
      {
        personEntityId: person1.id,
        troupeEntityId: troupe1.id,
        membershipRole: "团员",
        isCurrent: true
      },
      {
        personEntityId: person2.id,
        troupeEntityId: troupe2.id,
        membershipRole: "团员",
        isCurrent: true
      }
    ]
  });

  await prisma.entityRelation.createMany({
    data: [
      { fromEntityId: person1.id, toEntityId: work1.id, relationType: "rep_work", sortOrder: 0 },
      { fromEntityId: person1.id, toEntityId: work2.id, relationType: "rep_excerpt", sortOrder: 0 },
      { fromEntityId: person2.id, toEntityId: work3.id, relationType: "rep_work", sortOrder: 0 },
      { fromEntityId: person2.id, toEntityId: work2.id, relationType: "rep_excerpt", sortOrder: 1 }
    ]
  });

  const venue1 = await createEntity({
    type: EntityType.venue,
    slug: "上海大剧院",
    title: "上海大剧院",
    createdById: admin.id,
    updatedById: admin.id,
    content: "上海重要演出场馆。",
    sourceIds: [sourceMap.shkun.id],
    nested: {
      venue: {
        create: {
          venueType: "theater",
          cityEntityId: cityShanghai.id,
          region: "上海",
          city: "上海",
          address: "上海市黄浦区人民大道300号",
          capacity: 1800,
          description: "上海重要演出场馆。"
        }
      }
    }
  });

  const venue2 = await createEntity({
    type: EntityType.venue,
    slug: "苏州昆曲传习所剧场",
    title: "苏州昆曲传习所剧场",
    createdById: admin.id,
    updatedById: admin.id,
    content: "与昆曲历史关联紧密的演出空间。",
    sourceIds: [sourceMap.sukun.id],
    nested: {
      venue: {
        create: {
          venueType: "theater",
          cityEntityId: citySuzhou.id,
          region: "江苏",
          city: "苏州",
          address: "苏州市姑苏区宫巷",
          capacity: 500,
          description: "与昆曲历史关联紧密的演出空间。"
        }
      }
    }
  });

  const event1 = await createEntity({
    type: EntityType.event,
    slug: "2026_04_10_上海昆剧团_青春版_牡丹亭_上海专场",
    title: "青春版《牡丹亭》上海专场",
    createdById: admin.id,
    updatedById: admin.id,
    content: "面向公众开放的重点演出专场。",
    sourceIds: [sourceMap.eventNotice.id],
    nested: {
      event: {
        create: {
          eventType: "performance",
          businessStatus: EventStatus.scheduled,
          startAt: new Date("2026-04-10T19:30:00+08:00"),
          endAt: new Date("2026-04-10T22:00:00+08:00"),
          cityEntityId: cityShanghai.id,
          venueEntityId: venue1.id,
          troupeEntityId: troupe1.id,
          organizerText: "上海昆剧团",
          ticketUrl: "https://example.com/ticket/mudanting-shanghai",
          durationText: "2小时30分钟",
          ticketStatus: "少量余票",
          noteText: "含导赏环节",
          lastVerifiedAt: new Date("2026-03-25T17:00:00+08:00")
        }
      }
    }
  });

  const event2 = await createEntity({
    type: EntityType.event,
    slug: "2026_05_18_苏州昆剧院_长生殿_苏州纪念演出",
    title: "《长生殿》苏州纪念演出",
    createdById: admin.id,
    updatedById: admin.id,
    content: "纪念性专题演出，包含导赏与片段演出。",
    sourceIds: [sourceMap.sukun.id],
    nested: {
      event: {
        create: {
          eventType: "memorial",
          businessStatus: EventStatus.announced,
          startAt: new Date("2026-05-18T19:00:00+08:00"),
          endAt: new Date("2026-05-18T21:30:00+08:00"),
          cityEntityId: citySuzhou.id,
          venueEntityId: venue2.id,
          troupeEntityId: troupe2.id,
          organizerText: "苏州昆剧院",
          durationText: "2小时30分钟",
          ticketStatus: "待开票",
          noteText: "含导赏与纪念分享",
          lastVerifiedAt: new Date("2026-03-26T16:00:00+08:00")
        }
      }
    }
  });

  const event3 = await createEntity({
    type: EntityType.event,
    slug: "2025_12_12_unknown_troupe_昆曲知识沙龙_从行当到身段",
    title: "昆曲知识沙龙：从行当到身段",
    createdById: admin.id,
    updatedById: admin.id,
    content: "已完成的公开知识活动，用于历史统计与内容沉淀。",
    sourceIds: [sourceMap.lexicon.id],
    nested: {
      event: {
        create: {
          eventType: "lecture",
          businessStatus: EventStatus.completed,
          startAt: new Date("2025-12-12T19:00:00+08:00"),
          endAt: new Date("2025-12-12T21:00:00+08:00"),
          cityEntityId: cityBeijing.id,
          organizerText: "昆曲推广小组",
          durationText: "2小时",
          ticketStatus: "已结束",
          noteText: "已完成的公开知识活动",
          lastVerifiedAt: new Date("2025-12-13T09:00:00+08:00")
        }
      }
    }
  });

  await prisma.eventSession.createMany({
    data: [
      {
        eventEntityId: event1.id,
        sessionTitle: "晚场",
        startAt: new Date("2026-04-10T19:30:00+08:00"),
        endAt: new Date("2026-04-10T22:00:00+08:00"),
        venueEntityId: venue1.id,
        status: EventStatus.scheduled
      },
      {
        eventEntityId: event2.id,
        sessionTitle: "纪念专场",
        startAt: new Date("2026-05-18T19:00:00+08:00"),
        endAt: new Date("2026-05-18T21:30:00+08:00"),
        venueEntityId: venue2.id,
        status: EventStatus.scheduled
      },
      {
        eventEntityId: event3.id,
        sessionTitle: "讲座场",
        startAt: new Date("2025-12-12T19:00:00+08:00"),
        endAt: new Date("2025-12-12T21:00:00+08:00"),
        status: EventStatus.completed
      }
    ]
  });

  await prisma.eventProgramItem.createMany({
    data: [
      {
        eventEntityId: event1.id,
        workEntityId: work2.id,
        titleOverride: "牡丹亭·游园惊梦",
        sequenceNo: 1,
        durationMinutes: 75
      },
      {
        eventEntityId: event1.id,
        titleOverride: "回生",
        sequenceNo: 2,
        durationMinutes: 40
      },
      {
        eventEntityId: event2.id,
        workEntityId: work3.id,
        titleOverride: "长生殿选段",
        sequenceNo: 1,
        durationMinutes: 90
      }
    ]
  });

  await prisma.eventParticipant.createMany({
    data: [
      {
        eventEntityId: event1.id,
        troupeEntityId: troupe1.id,
        participationRole: "performer",
        creditedAs: "上海昆剧团",
        sortOrder: 0
      },
      {
        eventEntityId: event2.id,
        troupeEntityId: troupe2.id,
        participationRole: "performer",
        creditedAs: "苏州昆剧院",
        sortOrder: 0
      }
    ]
  });

  const article1 = await createEntity({
    type: EntityType.article,
    slug: "行当",
    title: "行当",
    createdById: admin.id,
    updatedById: admin.id,
    content: "昆曲行当常见分为生、旦、净、末、丑，各自又有细分。",
    sourceIds: [sourceMap.lexicon.id],
    nested: {
      article: {
        create: {
          articleType: "term",
          abstract: "昆曲表演中的人物类型与表演分工系统。"
        }
      }
    }
  });

  await prisma.entityRevision.createMany({
    data: [
      {
        entityId: work1.id,
        revisionNo: 1,
        title: "牡丹亭",
        bodyMarkdown: "《牡丹亭》是昆曲最具代表性的作品之一。",
        editSummary: "初始化剧目条目",
        reviewStatus: ReviewStatus.approved,
        editorId: admin.id,
        reviewerId: reviewer.id,
        reviewedAt: new Date()
      },
      {
        entityId: event1.id,
        revisionNo: 1,
        title: "青春版《牡丹亭》上海专场",
        bodyMarkdown: "面向公众开放的重点演出专场。",
        editSummary: "录入演出详情",
        reviewStatus: ReviewStatus.approved,
        editorId: admin.id,
        reviewerId: reviewer.id,
        reviewedAt: new Date()
      },
      {
        entityId: article1.id,
        revisionNo: 1,
        title: "行当",
        bodyMarkdown: "昆曲行当常见分为生、旦、净、末、丑，各自又有细分。",
        editSummary: "初始化知识条目",
        reviewStatus: ReviewStatus.approved,
        editorId: admin.id,
        reviewerId: reviewer.id,
        reviewedAt: new Date()
      }
    ]
  });

  const proposal = await prisma.editProposal.create({
    data: {
      entityId: event1.id,
      proposerId: editor.id,
      proposalType: "content_update",
      payloadJson: {
        title: "青春版《牡丹亭》上海专场",
        bodyMarkdown: "面向公众开放的重点演出专场，已补充购票与核对信息。",
        editSummary: "补充票务链接与场次时间"
      }
    }
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        actionType: "seed.create",
        targetType: "system",
        targetId: "bootstrap"
      },
      {
        actorId: editor.id,
        actionType: "proposal.create",
        targetType: "event",
        targetId: event1.id,
        payloadJson: { proposalId: proposal.id }
      }
    ]
  });

  const searchEntities = await prisma.entity.findMany({
    include: {
      content: true,
      sourceRefs: { include: { source: true } }
    }
  });

  for (const entity of searchEntities) {
    await prisma.searchIndex.create({
      data: {
        entityId: entity.id,
        entityType: entity.entityType,
        title: entity.title,
        searchText: [
          entity.title,
          entity.content?.bodyMarkdown,
          ...entity.sourceRefs.map((item) => item.source.title)
        ]
          .filter(Boolean)
          .join(" ")
      }
    });
  }
}

async function createEntity(input: {
  type: EntityType;
  slug: string;
  title: string;
  createdById: string;
  updatedById: string;
  content: string;
  sourceIds: string[];
  nested: Record<string, unknown>;
}) {
  const entity = await prisma.entity.create({
    data: {
      entityType: input.type,
      slug: input.slug,
      title: input.title,
      status: PublishStatus.published,
      visibility: "public",
      createdById: input.createdById,
      updatedById: input.updatedById,
      publishedAt: new Date(),
      content: {
        create: {
          bodyMarkdown: input.content
        }
      },
      ...input.nested
    }
  });

  await prisma.entitySourceRef.createMany({
    data: input.sourceIds.map((sourceId, index) => ({
      entityId: entity.id,
      sourceId,
      sortOrder: index
    }))
  });

  return entity;
}

const isDirectRun = Boolean(process.argv[1]?.includes("prisma/seed"));

if (isDirectRun) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
