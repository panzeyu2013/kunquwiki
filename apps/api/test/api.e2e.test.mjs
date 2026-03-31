import "reflect-metadata";

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient, UserStatus } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../dist/src/app.module.js";
import { seedDatabase } from "../dist/prisma/seed.js";

process.env.DATABASE_URL = "postgresql://kunquwiki:kunquwiki@localhost:5432/kunquwiki?schema=public";
process.env.JWT_SECRET = "change-me-in-production";
process.env.BOT_API_ENABLED = "true";
process.env.BOT_API_TOKEN = "test-bot-token";
process.env.BOT_ACTOR_USERNAME = "bot";

const schemaPath = path.resolve(process.cwd(), "apps/api/prisma/schema.prisma");

test("P0 API flows work end-to-end", async (t) => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    t.skip(`本地 PostgreSQL 不可用，跳过 API 端到端测试：${error instanceof Error ? error.message : "unknown error"}`);
    return;
  }

  execFileSync("npx", ["prisma", "db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"], {
    cwd: process.cwd(),
    stdio: "pipe"
  });

  await seedDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  const server = app.getHttpServer();

  await t.test("home payload exposes portal data", async () => {
    const response = await request(server).get("/api/home").expect(200);
    assert.equal(response.body.hero.title, "KunquWiki");
    assert.ok(Array.isArray(response.body.featuredEvents));
    assert.ok(Array.isArray(response.body.recentChanges));
  });

  await t.test("event filtering works by city and status", async () => {
    const response = await request(server)
      .get("/api/entities")
      .query({ type: "event", city: "上海", status: "scheduled" })
      .expect(200);

    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].slug, "2026_04_10_上海昆剧团_青春版_牡丹亭_上海专场");
  });

  await t.test("entity detail includes related navigation", async () => {
    const response = await request(server).get("/api/entities/%E7%89%A1%E4%B8%B9%E4%BA%AD").expect(200);
    assert.ok(Array.isArray(response.body.relatedEntities));
    assert.ok(response.body.relatedEntities.length > 0);
  });

  await t.test("duplicate registration returns conflict", async () => {
    await request(server)
      .post("/api/auth/register")
      .send({
        username: "new-user",
        displayName: "新用户",
        email: "new-user@example.com",
        password: "Kunquwiki123!"
      })
      .expect(201);

    await request(server)
      .post("/api/auth/register")
      .send({
        username: "new-user",
        displayName: "重复用户",
        email: "duplicate@example.com",
        password: "Kunquwiki123!"
      })
      .expect(409);
  });

  await t.test("seeded users can log in with expected role sets", async () => {
    const adminLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Kunquwiki123!" })
      .expect(201);
    assert.deepEqual(adminLogin.body.user.roles, ["admin", "reviewer", "editor"]);

    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);
    assert.deepEqual(reviewerLogin.body.user.roles, ["reviewer", "editor"]);

    const visitorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "visitor", password: "Kunquwiki123!" })
      .expect(201);
    assert.deepEqual(visitorLogin.body.user.roles, ["visitor"]);
  });

  await t.test("suspended users cannot log in", async () => {
    await prisma.user.update({
      where: { username: "editor" },
      data: { status: UserStatus.suspended }
    });

    await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(401);

    await prisma.user.update({
      where: { username: "editor" },
      data: { status: UserStatus.active }
    });
  });

  await t.test("proposal submission and approval write back the entity", async () => {
    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);
    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);

    const editorToken = editorLogin.body.token;
    const reviewerToken = reviewerLogin.body.token;

    const proposal = await request(server)
      .post("/api/entities/%E7%89%A1%E4%B8%B9%E4%BA%AD/proposals")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        proposalType: "content_update",
        editSummary: "测试写回",
        payload: {
          title: "牡丹亭",
          bodyMarkdown: "测试环境下的新正文"
        }
      })
      .expect(201);

    const queueBefore = await request(server)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${reviewerToken}`)
      .expect(200);
    assert.ok(queueBefore.body.some((item) => item.id === proposal.body.id));

    await request(server)
      .patch(`/api/moderation/proposals/${proposal.body.id}`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ decision: "approved", reviewComment: "测试通过" })
      .expect(200);

    const entity = await request(server).get("/api/entities/%E7%89%A1%E4%B8%B9%E4%BA%AD").expect(200);
    assert.equal(entity.body.plot, "测试环境下的新正文");

    const revisions = await request(server).get("/api/changes").expect(200);
    assert.ok(revisions.body.some((item) => item.editSummary === "测试写回"));

    const queueAfter = await request(server)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${reviewerToken}`)
      .expect(200);
    assert.ok(!queueAfter.body.some((item) => item.id === proposal.body.id));
  });

  await t.test("blank edit note falls back to user signature and timestamp", async () => {
    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);
    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);

    const proposal = await request(server)
      .post("/api/entities/%E8%A1%8C%E5%BD%93/proposals")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .send({
        proposalType: "content_update",
        editSummary: "",
        payload: {
          title: "行当",
          bodyMarkdown: "补充空编辑说明后的正文"
        }
      })
      .expect(201);

    await request(server)
      .patch(`/api/moderation/proposals/${proposal.body.id}`)
      .set("Authorization", `Bearer ${reviewerLogin.body.token}`)
      .send({ decision: "approved", reviewComment: "允许默认编辑说明" })
      .expect(200);

    const revisions = await request(server).get("/api/changes").expect(200);
    const fallbackRevision = revisions.body.find((item) => item.entityId === proposal.body.entityId);
    assert.ok(fallbackRevision);
    assert.match(fallbackRevision.editSummary, /^.+ \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
  });

  await t.test("bot api supports health check and dry-run import", async () => {
    const health = await request(server)
      .get("/api/bot/check/health")
      .set("X-Bot-Token", process.env.BOT_API_TOKEN)
      .expect(200);
    assert.equal(health.body.ok, true);

    const schemaCheck = await request(server)
      .post("/api/bot/check")
      .set("X-Bot-Token", process.env.BOT_API_TOKEN)
      .send({
        checkType: "schema",
        items: [
          {
            externalId: "CITY_TEST",
            entityType: "city",
            title: "测试城市"
          }
        ]
      })
      .expect(201);
    assert.equal(schemaCheck.body.passed, true);

    const dryRun = await request(server)
      .post("/api/bot/import")
      .set("X-Bot-Token", process.env.BOT_API_TOKEN)
      .send({
        items: [
          {
            externalId: "CITY_TEST",
            entityType: "city",
            title: "测试城市",
            initialData: { province: "测试省" }
          }
        ],
        options: {
          dryRun: true,
          upsert: true
        }
      })
      .expect(201);

    assert.equal(dryRun.body.summary.total, 1);
    assert.equal(dryRun.body.summary.failedCount, 0);
    assert.equal(dryRun.body.results[0].message, "dry_run");
  });

  await t.test("approved event edits keep the original slug stable", async () => {
    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);
    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);

    const shanghaiTroupe = await prisma.entity.findUnique({ where: { slug: "上海昆剧团" } });
    assert.ok(shanghaiTroupe);

    const proposal = await request(server)
      .post("/api/entities/2026_04_10_%E4%B8%8A%E6%B5%B7%E6%98%86%E5%89%A7%E5%9B%A2_%E9%9D%92%E6%98%A5%E7%89%88_%E7%89%A1%E4%B8%B9%E4%BA%AD_%E4%B8%8A%E6%B5%B7%E4%B8%93%E5%9C%BA/proposals")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .send({
        proposalType: "content_update",
        editSummary: "更新演出标题并触发 slug 重算",
        payload: {
          title: "青春版《牡丹亭》加演",
          bodyMarkdown: "更新后的演出说明",
          startAt: "2026-04-18T19:30:00.000Z",
          troupeIds: [shanghaiTroupe.id]
        }
      })
      .expect(201);

    await request(server)
      .patch(`/api/moderation/proposals/${proposal.body.id}`)
      .set("Authorization", `Bearer ${reviewerLogin.body.token}`)
      .send({ decision: "approved", reviewComment: "编辑后保留原 slug" })
      .expect(200);

    const eventAfterApproval = await request(server)
      .get("/api/entities/2026_04_10_%E4%B8%8A%E6%B5%B7%E6%98%86%E5%89%A7%E5%9B%A2_%E9%9D%92%E6%98%A5%E7%89%88_%E7%89%A1%E4%B8%B9%E4%BA%AD_%E4%B8%8A%E6%B5%B7%E4%B8%93%E5%9C%BA")
      .expect(200);
    assert.equal(eventAfterApproval.body.title, "青春版《牡丹亭》加演");
    assert.equal(eventAfterApproval.body.slug, "2026_04_10_上海昆剧团_青春版_牡丹亭_上海专场");
  });

  await t.test("structured person proposal writes back identities and troupe relations", async () => {
    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);
    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);

    const proposal = await request(server)
      .post("/api/entities/%E5%BC%A0%E5%86%9B/proposals")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .send({
        proposalType: "content_update",
        editSummary: "补充人物关联信息",
        payload: {
          title: "张军",
          bodyMarkdown: "更新后的人物简介",
          bio: "更新后的人物简介",
          identities: ["演员", "推广者", "教师"],
          troupeIds: [(await prisma.entity.findUnique({ where: { slug: "上海昆剧团" } })).id]
        }
      })
      .expect(201);

    await request(server)
      .patch(`/api/moderation/proposals/${proposal.body.id}`)
      .set("Authorization", `Bearer ${reviewerLogin.body.token}`)
      .send({ decision: "approved", reviewComment: "结构化人物信息通过" })
      .expect(200);

    const person = await request(server).get("/api/entities/%E5%BC%A0%E5%86%9B").expect(200);
    assert.equal(person.body.bio, "更新后的人物简介");
    assert.ok(person.body.roles.includes("教师"));
    assert.ok(person.body.troupeIds.length > 0);
  });

  await t.test("admin can update user access and promote editor to reviewer", async () => {
    const adminLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Kunquwiki123!" })
      .expect(201);

    const editorUser = await prisma.user.findUnique({ where: { username: "editor" } });
    assert.ok(editorUser);

    const updated = await request(server)
      .patch(`/api/admin/users/${editorUser.id}`)
      .set("Authorization", `Bearer ${adminLogin.body.token}`)
      .send({ roles: ["editor", "reviewer"] })
      .expect(200);

    assert.deepEqual(updated.body.roles, ["editor", "reviewer"]);

    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);
    assert.deepEqual(editorLogin.body.user.roles, ["editor", "reviewer"]);

    await request(server)
      .get("/api/moderation/queue")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .expect(200);
  });

  await t.test("admin overview and user list require admin", async () => {
    const reviewerLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "reviewer", password: "Kunquwiki123!" })
      .expect(201);
    const adminLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Kunquwiki123!" })
      .expect(201);

    await request(server)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${reviewerLogin.body.token}`)
      .expect(401);

    await request(server)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminLogin.body.token}`)
      .expect(200);
  });

  await t.test("editor can quick-create placeholder troupe and excerpt", async () => {
    const editorLogin = await request(server)
      .post("/api/auth/login")
      .send({ identifier: "editor", password: "Kunquwiki123!" })
      .expect(201);

    const troupeResponse = await request(server)
      .post("/api/editor/quick-create")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .send({ entityType: "troupe", title: "测试新剧团" })
      .expect(201);
    assert.equal(troupeResponse.body.title, "测试新剧团");

    const mudanting = await prisma.entity.findUnique({ where: { slug: "牡丹亭" } });
    assert.ok(mudanting);

    const excerptResponse = await request(server)
      .post("/api/editor/quick-create")
      .set("Authorization", `Bearer ${editorLogin.body.token}`)
      .send({ entityType: "work", title: "寻梦", workType: "excerpt", parentWorkId: mudanting.id })
      .expect(201);
    assert.equal(excerptResponse.body.title, "牡丹亭·寻梦");
  });

  await t.test("search returns indexed entities", async () => {
    const response = await request(server).get("/api/search").query({ q: "牡丹亭" }).expect(200);
    assert.ok(response.body.some((item) => item.slug === "牡丹亭"));
  });

  await app.close();
  await prisma.$disconnect();
});
