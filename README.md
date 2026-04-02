# KunquWiki

KunquWiki 是一个面向昆曲资料整理、演出追踪、公共协作编辑与可审核发布的 Wiki 型站点。它不是通用 CMS，也不是单纯的博客，而是一套围绕“结构化条目 + 演出数据库 + 提案审核 + 可追溯版本”设计的垂直知识站。

当前仓库已经具备一条完整的 P0/P1 业务主链路：

- 公共浏览：首页、演出、剧目、人物、院团、场馆、知识条目、统计、搜索、标签页
- 实体详情：剧目、人物、院团、场馆、演出、文章详情页
- 协作编辑：登录、提交结构化编辑提案、审核通过后写回实体
- 后台协作：审核队列、最近更改、版本历史、后台用户权限管理
- 数据模型：实体主表 + 专用实体表 + 关系表 + 审核表 + 搜索索引
- 基础自动化：Prisma migration、seed、类型检查、构建、API e2e 测试
- 演出解析：官宣链接 -> 清洗文本 -> AI/规则解析 -> 预览 -> 写回表单

这份 README 的重点不是“命令清单”，而是帮助你理解：

- 仓库整体怎么分层
- 各模块在什么时机调用彼此
- 数据从页面到 API、再到数据库是如何流动的
- 各页面、组件、服务、Repository 分别负责什么
- 当前实现已经完成到什么程度，哪里仍是后续可继续扩展的点

## 1. 项目定位

KunquWiki 的核心目标是提供一套围绕昆曲知识和演出信息组织的数据平台：

- 以 `Entity` 为统一入口管理公共条目
- 用专用子表保存不同实体类型的结构化字段
- 用关系表表达“人物-院团”“演出-节目单”“演出-参与者”等强业务关系
- 用提案审核流保证公开内容的可控写回
- 用搜索索引、引用来源、版本历史支撑可检索性和可信度

它比较接近“垂直领域知识站 + 数据库前台”的组合，而不是“富文本网站”。

## 2. 技术栈与设计理由

### 2.1 技术栈

- 前端：Next.js App Router
- 后端：NestJS
- 数据库：PostgreSQL
- ORM：Prisma
- 共享类型：`packages/shared`
- 测试：
  - API 端到端：Node test + Supertest
  - Web 单元测试：Node test

### 2.2 为什么这样分层

项目采用的是很明确的“前台渲染层 / API 业务层 / 数据持久层”分层：

- `apps/web`
  负责页面、交互、登录状态、表单提交、后台界面
- `apps/api`
  负责鉴权、聚合查询、审核写回、后台统计、搜索、数据库一致性
- `PostgreSQL + Prisma`
  负责结构化数据存储、关系维护、迁移、seed
- `packages/shared`
  负责前后端共享的实体基础类型

这样做的价值：

- 前端不会直接承载业务规则
- 审核写回集中在后端，规则不会散落
- 数据结构可以继续扩展专题、媒体、开放 API，而不用推翻现有架构

## 3. 仓库结构

```text
kunquwiki/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── content.repository.ts
│   │   │   ├── dto.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── search-index.service.ts
│   │   ├── test/
│   │   │   └── api.e2e.test.mjs
│   │   └── package.json
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── test/
│       └── package.json
├── packages/
│   └── shared/
│       └── src/index.ts
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```

## 4. Workspace 与脚本关系

根仓库使用 npm workspace 管理。

### 4.1 根脚本

位于 [package.json](/root/kunquwiki/package.json)：

- `npm run dev`
  同时启动 API 与 Web
- `npm run build`
  依次构建 `shared -> api -> web`
- `npm run lint`
  对 `api` 和 `web` 跑 TypeScript 检查
- `npm run test`
  构建 API 后，运行 API e2e 与 Web 测试
- `npm run seed`
  执行 API workspace 的 seed
- `npm run db:generate`
  生成 Prisma Client
- `npm run db:push`
  推送 schema 到数据库
- `npm run db:migrate`
  创建并执行开发迁移
- `npm run db:deploy`
  部署生产迁移

### 4.2 API 子脚本

位于 [apps/api/package.json](/root/kunquwiki/apps/api/package.json)：

- `dev`
  用 `ts-node` 启动 Nest 应用
- `build`
  编译 `src/**/*.ts` 和 `prisma/**/*.ts` 到 `dist`，并拷贝 `prisma/seeds` 到 `dist/prisma/seeds`
- `start`
  运行构建后的 API
- `test:e2e`
  先 build，再运行 `test/api.e2e.test.mjs`
- `prisma:generate`
  生成 Prisma Client
- `db:*`
  数据库 push/migrate/deploy
- `seed`
  执行 `prisma/seed.ts`

### 4.3 Web 子脚本

位于 [apps/web/package.json](/root/kunquwiki/apps/web/package.json)：

- `dev`
  启动 Next.js 开发服务
- `build`
  生产构建
- `start`
  启动生产构建产物
- `lint`
  跑 TypeScript 类型检查

## 5. 当前系统的核心业务对象

核心 schema 位于 [schema.prisma](/root/kunquwiki/apps/api/prisma/schema.prisma)。

### 5.1 统一入口：`Entity`

所有公开条目都从 `Entity` 开始。它保存所有类型共有的信息：

- `entityType`
- `slug`
- `title`
- `subtitle`
- `status`
- `visibility`
- `createdById`
- `updatedById`
- `publishedAt`
- `createdAt`
- `updatedAt`

这意味着：

- URL 与公开展示入口统一
- 列表页、搜索页、详情页都可以先按 `Entity` 聚合
- 子表只负责“这个类型自己的字段”

### 5.2 专用实体表

不同实体类型使用专用子表承载结构化字段。

#### `Work`

表示剧目。

主要字段：

- `workType`
- `parentWorkId`
- `originalAuthor`
- `dynastyPeriod`
- `genreNote`
- `synopsis`
- `plot`
- `durationMinutes`
- `firstKnownDate`

#### `Person`

表示人物。

主要字段：

- `personTypeNote`
- `gender`
- `birthDate`
- `deathDate`
- `birthCityEntityId`
- `bio`
- `isLiving`

#### `Troupe`

表示院团。

主要字段：

- `troupeType`
- `foundedDate`
- `dissolvedDate`
- `cityEntityId`
- `city`
- `region`
- `description`
- `officialWebsite`

#### `Venue`

表示场馆。

主要字段：

- `venueType`
- `country`
- `cityEntityId`
- `region`
- `city`
- `address`
- `latitude`
- `longitude`
- `capacity`
- `description`

#### `Event`

表示演出事件。

主要字段：

- `eventType`
- `businessStatus`
- `startAt`
- `endAt`
- `timezone`
- `cityEntityId`
- `venueEntityId`
- `troupeEntityId`
- `organizerText`
- `ticketUrl`
- `durationText`
- `ticketStatus`
- `noteText`
- `posterImageId`
- `description`
- `lastVerifiedAt`

#### `Article`

表示知识条目。

主要字段：

- `articleType`
- `abstract`
- `difficultyLevel`
- `bodySourceType`

#### 预留但当前前台未完整接入

数据库中还有以下实体类型：

- `role`
- `lineage`
- `topic`

当前 schema 已有定义，但前台详情页和完整编辑流尚未做成主路径。

### 5.3 关系表

#### `PersonIdentity`

描述人物身份履历，如：

- 演员
- 教师
- 导演

同时支持起止时间。

#### `PersonTroupeMembership`

描述人物与院团关系。

支持：

- 院团 ID
- 身份角色
- 起止时间
- 是否当前成员

#### `EventSession`

表示演出的具体场次。

一个 `Event` 可以对应多场 `EventSession`。

#### `EventProgramItem`

表示节目单条目。

支持：

- 关联 `Work`
- 自定义标题
- 顺序
- 时长
- 备注
- cast

#### `PerformanceCast`

表示节目单条目下的角色分配：

- 角色实体
- 人物实体
- 备注

#### `EventParticipant`

表示演出参与方：

- 人物
- 院团
- 参与角色
- creditedAs
- sortOrder

#### `EntityRelation`

通用实体关系表。

当前主要用于：

- 人物 -> 代表剧目
- 人物 -> 代表折子戏

### 5.4 正文、来源、版本、审核

#### `EntityContent`

存正文：

- `bodyMarkdown`
- `bodyHtml`
- `infoboxJson`
- `tocJson`

#### `Source` / `EntitySourceRef`

来源模型，支撑公开引用。

#### `EditProposal`

编辑提案模型。

前台编辑不会直接修改线上实体，而是提交提案，等待审核。

#### `EntityRevision`

通过审核后，系统生成修订快照：

- 标题
- 摘要
- 正文
- 结构化数据快照
- 编辑说明
- 审核状态
- 编辑者 / 审核者

#### `AuditLog`

记录后台和关键流程动作，如：

- 用户权限变更
- 提案创建
- 提案审批
- 快速创建条目

#### `SearchIndex`

搜索索引表，用来保存聚合搜索文本和标签。

## 6. 权限模型

用户角色定义在数据库枚举 `UserRole`：

- `visitor`
- `bot`
- `editor`
- `reviewer`
- `admin`

### 6.1 当前语义

- `visitor`
  只读账号。现在是排他角色，一旦设置为 `visitor`，会自动撤销其它角色。
- `bot`
  自动化账号，用于开放接口或后续流程机器人。
- `editor`
  可提交编辑提案，可完整创建实体。
- `reviewer`
  可访问审核队列并审批提案。
- `admin`
  可访问后台用户管理与后台概览。

### 6.2 权限判断位置

主要在 [auth.service.ts](/root/kunquwiki/apps/api/src/auth.service.ts) 中：

- `assertEditorRole`
- `assertReviewerRole`
- `assertAdminRole`
- `assertAutomationRole`

前台页面侧通过 [protected-page.tsx](/root/kunquwiki/apps/web/components/auth/protected-page.tsx) 做展示层拦截。

## 7. API 分层与调用关系

API 的调用链非常固定：

1. `Controller`
   解析 HTTP 请求、做基础鉴权
2. `AppService` / `AuthService`
   编排业务
3. `ContentRepository`
   真正执行数据库查询、聚合、写回逻辑
4. `SearchIndexService`
   在实体被改动后刷新搜索索引

### 7.1 模块关系

#### `AuthController`

位于 [auth.controller.ts](/root/kunquwiki/apps/api/src/auth.controller.ts)。

提供：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

#### `AppController`

位于 [app.controller.ts](/root/kunquwiki/apps/api/src/app.controller.ts)。

它是业务 API 总入口，主要提供：

- 公共读取：
  - `GET /api/home`
  - `GET /api/entities`
  - `GET /api/entities/:slug`
  - `GET /api/events/upcoming`
  - `GET /api/search`
  - `GET /api/changes`
  - `GET /api/stats`
- 编辑辅助：
  - `GET /api/editor/options`
  - `POST /api/editor/quick-create`
  - `POST /api/events/parse`
- 自动化开放接口：
  - `POST /api/open/entities`
  - `POST /api/open/entities/:slug/proposals`
- 协作编辑：
  - `POST /api/entities/:slug/proposals`
  - `GET /api/moderation/queue`
  - `PATCH /api/moderation/proposals/:id`
- 后台管理：
  - `GET /api/admin/overview`
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id`

#### `AppService`

位于 [app.service.ts](/root/kunquwiki/apps/api/src/app.service.ts)。

这个文件比较薄，主要做“路由到 Repository”的转发和轻量编排：

- `getHomePayload`
- `listEntities`
- `getEntityBySlug`
- `search`
- `getRecentChanges`
- `getModerationQueue`
- `getStats`
- `createProposal`
- `reviewProposal`
- `getAdminOverview`
- `getEditorOptions`
- `createQuickEntity`
- `parseEventLink`

#### `ContentRepository`

位于 [content.repository.ts](/root/kunquwiki/apps/api/src/content.repository.ts)。

这是目前整个后端最核心的文件，承担了几乎所有领域逻辑：

- 首页聚合
- 列表筛选
- 详情聚合
- 搜索
- 最近更改
- 审核队列
- 管理概览
- 编辑器选项
- 完整新建实体
- 创建提案
- 审核通过后写回实体
- 生成版本记录
- 重建搜索索引
- 关联实体推导
- 事件记录推导

可以把它理解成当前项目的“领域 Repository + 聚合查询中心”。

#### `SearchIndexService`

位于 [search-index.service.ts](/root/kunquwiki/apps/api/src/search-index.service.ts)。

职责：

- 基于实体与结构化信息重建 `SearchIndex`
- 在新建实体、提案审批通过后同步刷新搜索文本

### 7.2 一个典型请求的完整链路

#### 场景 A：打开人物详情页

1. 浏览器访问 `/people/zhang-jun`
2. Next 页面调用 `apps/web/lib/api.ts` 的 `getEntity(slug)`
3. Web 请求 `GET /api/entities/zhang-jun`
4. `AppController.getEntity`
5. `AppService.getEntityBySlug`
6. `ContentRepository.getEntityBySlug`
7. Repository：
   - 读取 `Entity`
   - include 人物子表、身份、院团关系、来源、标签等
   - 调用 `mapEntity`
   - 推导 `relatedEntities`
   - 推导 `upcomingEvents` / `pastEvents`
8. 返回聚合后的实体 JSON
9. Next 页面把数据交给详情页组件渲染

#### 场景 B：提交编辑提案

1. 用户进入 `/edit/:slug`
2. 页面挂载 [edit-proposal-form.tsx](/root/kunquwiki/apps/web/components/forms/edit-proposal-form.tsx)
3. 表单先调：
   - `getEntityPublic(slug)`
   - `getEditorOptions(entityType, entityId)`
4. 用户修改字段并提交
5. Web 调用 `submitProposal`
6. 请求 `POST /api/entities/:slug/proposals`
7. `AppController.createProposal`
8. `AuthService.assertEditorRole`
9. `AppService.createProposal`
10. `ContentRepository.createProposal`
11. 提案写入 `EditProposal`，并记录 `AuditLog`

#### 场景 C：审核通过提案

1. 审核员进入 `/moderation/queue`
2. 页面请求 `GET /api/moderation/queue`
3. 审核员点击通过
4. Web 请求 `PATCH /api/moderation/proposals/:id`
5. `AuthService.assertReviewerRole`
6. `ContentRepository.reviewProposal`
7. 它会在事务里：
   - 更新提案状态
   - 更新 `Entity`
   - upsert `EntityContent`
   - 调用 `applyStructuredProposal`
   - 创建 `EntityRevision`
   - 重建 `SearchIndex`
   - 记录 `AuditLog`

#### 场景 D：完整新建实体（提案方式）

1. 用户进入 `/create/[entityType]`
2. 页面使用完整表单，填写结构化字段
3. 提交后调用 `submitCreateProposal`
4. 请求 `POST /api/entities/proposals`
5. `ContentRepository.createEntityProposal`
6. 提案进入审核队列，审核通过后才真正创建实体并写回结构化字段

## 8. Web 层结构与职责

### 8.1 App Router 页面

位于 `apps/web/app`。

#### 公共浏览

- `/`
  首页
- `/performances`
  演出聚合页
- `/events`
  演出列表页
- `/works`
  剧目列表页
- `/people`
  人物列表页
- `/troupes`
  院团列表页
- `/venues`
  场馆列表页
- `/articles`
  知识条目列表页
- `/search`
  搜索页
- `/stats`
  统计页
- `/tags/[tag]`
  标签页

#### 详情页

- `/events/[slug]`
- `/works/[slug]`
- `/people/[slug]`
- `/troupes/[slug]`
- `/venues/[slug]`
- `/articles/[slug]`

#### 协作与后台

- `/login`
  登录页
- `/edit/[slug]`
  提交编辑提案
- `/create/[entityType]`
  完整新建实体
- `/changes`
  最近更改
- `/history/[entityId]`
  历史版本
- `/moderation/queue`
  审核队列
- `/admin`
  后台概览与用户管理
- `/discussion/[slug]`
  讨论页占位

### 8.2 页面级公共壳

#### `layout.tsx`

根布局，注入全局 CSS 和 `SiteShell`。

#### `SiteShell`

位于 [site-shell.tsx](/root/kunquwiki/apps/web/components/site-shell.tsx)。

职责：

- 顶部导航
- 品牌区
- 页面内容容器
- 登录状态入口

### 8.3 Web 数据访问层

#### `lib/api.ts`

服务端读取 API 的入口，供页面 `async` 调用。

特点：

- 用于 Next 页面服务端请求
- 带 mock fallback
- 返回 `packages/shared` 中的实体类型

主要函数：

- `getHomeData`
- `getEntities`
- `getEntity`
- `searchEntities`
- `getRecentChanges`
- `getModerationQueue`
- `getStats`

#### `lib/api-client.ts`

客户端交互 API 封装，供表单和后台组件调用。

特点：

- 自动写 `Authorization`
- 用于登录、表单提交、审核、后台操作

主要函数：

- `login`
- `register`
- `getMe`
- `getEntityPublic`
- `getEditorOptions`
- `createQuickEntityClient`
- `parseEventFromLink`
- `submitProposal`
- `getModerationQueueClient`
- `reviewProposal`
- `getAdminOverviewClient`
- `getAdminUsersClient`
- `updateAdminUserClient`

### 8.4 认证相关组件

#### `auth-status.tsx`

显示当前登录态入口。

#### `use-auth-user.ts`

从本地 token 解析或请求用户信息，为客户端页面提供登录态。

#### `protected-page.tsx`

客户端权限包装器。

使用方式：

- 后台页面或编辑页面用它包起来
- 指定 `allowedRoles`
- 未登录或无权限时展示统一提示

### 8.5 表单组件

#### `edit-proposal-form.tsx`

当前最重要的表单组件。

它同时承担：

- 编辑已有实体时的“提案编辑表单”
- 新建实体时的“完整创建表单”

当前它已经取代了原本的 quick create 主流程。

职责包括：

- 根据实体类型初始化默认字段
- 加载当前实体
- 加载 editor options
- 支持单选关联实体和多选关联实体
- 支持结构化 JSON 字段输入
- 构建提交 payload
- 选择走“创建实体”还是“提交提案”

当前特别重要的一点：

- 简单字段直接用输入框
- 一对多 / 多层嵌套结构，如节目单、cast、人物身份履历、人物院团履历，都已经有结构化子表单
- 如果输入的名称在数据库中不存在，会加入“待创建实体列表”，提交提案时才会创建占位条目

#### `quick-create-form.tsx`

这是一个遗留组件。

它仍在仓库中，但当前 `/create/[entityType]` 已不再使用它作为主路径。可以视为旧方案遗留，后续如果确认不再需要，可以删除。

#### `login-form.tsx`

登录与注册表单。

#### `moderation-queue-client.tsx`

审核队列客户端组件：

- 拉取审核列表
- 展示提案内容
- 执行通过/驳回

#### `admin-dashboard.tsx`

后台概览与用户管理组件。

职责：

- 展示待审核提案数量
- 展示审计日志
- 展示最近修订
- 管理用户角色与状态

当前角色管理逻辑已经实现：

- `visitor` 设为排他
- `editor/reviewer/admin/bot` 保持独立可切换

#### `recent-changes-client.tsx`

最近更改页使用的客户端组件。

### 8.6 展示组件

#### `entity-grid.tsx`

实体卡片网格。

#### `event-list.tsx`

演出列表组件。

#### `event-record-section.tsx`

用于人物、院团、剧目、场馆详情页中的未来/过往演出表格。

#### `reference-list.tsx`

统一展示来源引用。

#### `related-entities.tsx`

展示关联实体推荐区。

#### `precise-countdown.tsx`

演出倒计时组件。

#### `section-card.tsx`

通用内容块组件。

## 9. Shared 类型包的作用

位于 [packages/shared/src/index.ts](/root/kunquwiki/packages/shared/src/index.ts)。

它定义了：

- `EntityType`
- `PublishStatus`
- `EventStatus`
- `ReviewStatus`
- 各实体公开类型：
  - `WorkEntity`
  - `PersonEntity`
  - `TroupeEntity`
  - `VenueEntity`
  - `EventEntity`
  - `ArticleEntity`
  - `CityEntity`
- `SearchResult`
- `RevisionRecord`
- `StatsOverview`

### 9.1 它的边界

`packages/shared` 当前更多是“公共展示实体”的共享类型，而不是“所有编辑接口”的完整契约。

也就是说：

- 详情页、列表页强依赖它
- 编辑页的完整字段目前主要仍在 `apps/web/lib/api-client.ts` 中单独声明

这是当前代码状态下一个很值得后续继续优化的点：

- 可以把完整编辑 DTO 也逐步收敛进共享类型

## 10. 搜索与聚合策略

### 10.1 搜索来源

搜索最终依赖 `SearchIndex`。

索引由 `SearchIndexService` 重建。

触发时机：

- 新建实体后
- 提案审核通过后

### 10.2 详情页关联实体如何来

详情页中的 `relatedEntities` 不是硬编码，而是由 `ContentRepository.getRelatedEntities()` 按实体类型推导：

- 演出：推导城市、剧团、节目单、参与者、剧场
- 人物：推导出生地、院团、代表剧目、相关演出
- 剧目：推导母剧、子剧、相关演出
- 院团：推导城市、成员、相关演出
- 场馆：推导城市、相关演出
- 文章：推导共享标签的相关实体
- 城市：推导相关场馆、院团

### 10.3 详情页的未来/过往演出如何来

`ContentRepository.getEntityEventRecords()` 按实体类型决定筛选条件：

- 人物：按参与者中的人物匹配
- 院团：按 lead troupe 或参与院团匹配
- 场馆：按 venue 匹配
- 城市：按 city 匹配
- 剧目：按 `EventProgramItem.workEntityId` 匹配

这是目前事件数据库前台展示的关键聚合逻辑。

## 11. 编辑与审核主流程

### 11.1 为什么不直接写数据库

前台编辑默认不直接改线上实体，而是：

1. 提交提案
2. 进入审核队列
3. 审核通过后写回实体并生成 revision

这样做的好处：

- 公开内容可控
- 审核人可追踪
- 有版本历史
- 有审计日志

补充：表单中如果输入了数据库中不存在的实体，会先进入“待创建实体列表”。提交提案时会提示确认，审核通过后才会真正创建这些占位实体。

### 11.2 编辑时的数据来源

编辑页通常先并行读取两类数据：

- 当前实体详情 `getEntityPublic`
- 编辑器选项 `getEditorOptions`

其中 `getEditorOptions` 返回：

- 人物、剧目、院团、场馆、城市可选项
- 行当选项
- 文章类型、演出类型、院团类型等枚举选项

### 11.3 审核通过后的写回逻辑

核心在 `ContentRepository.reviewProposal()`：

- 更新 `EditProposal.status`
- 更新 `Entity.title / summary / status / updatedById`
- upsert `EntityContent`
- 调用 `applyStructuredProposal()` 写回专用子表和关系表
- 新建 `EntityRevision`
- 重建搜索索引
- 写 `AuditLog`

### 11.4 `applyStructuredProposal()` 的意义

这是当前所有结构化写回的中心函数。

它按实体类型分别处理：

- `work`
- `person`
- `city`
- `troupe`
- `venue`
- `event`
- `article`

并负责更新：

- 子表字段
- 标签
- 人物身份
- 人物院团关系
- 人物代表作关系
- 演出场次
- 节目单
- cast
- 演出参与者

## 12. 自动化与开放接口

本仓库已经加入 `bot` 角色，并开放了自动化入口：

- `POST /api/open/entities`
- `POST /api/open/entities/:slug/proposals`

权限要求：

- `bot`
- `editor`
- `admin`

设计意图：

- 便于后续接入自动抓取、批量入库、半自动维护
- 自动化写入仍然复用现有实体创建和提案逻辑，不走旁路

## 13. 数据库与本地环境

### 13.1 Docker

[docker-compose.yml](/root/kunquwiki/docker-compose.yml) 提供本地 PostgreSQL 16：

- DB: `kunquwiki`
- User: `kunquwiki`
- Password: `kunquwiki`
- Port: `5432`

### 13.2 推荐本地启动顺序

1. 启动数据库
2. 生成 Prisma Client
3. 执行 migration 或 db push
4. 执行 seed
5. 启动 API 与 Web

示例：

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
npm run seed
npm run dev
```

## 14. Seed 数据与测试数据

[prisma/seed.ts](/root/kunquwiki/apps/api/prisma/seed.ts) 会初始化：

- 基础用户：
  - admin
  - reviewer
  - editor
  - visitor
  - bot
- 城市
- 剧目
- 人物
- 院团
- 场馆
- 演出
- 知识条目
- 标签
- 来源

这些 seed 数据支撑：

- 列表页
- 详情页
- 搜索页
- e2e 测试
- 后台示例数据

## 15. 测试现状

### 15.1 API e2e

位于 [apps/api/test/api.e2e.test.mjs](/root/kunquwiki/apps/api/test/api.e2e.test.mjs)。

覆盖的典型流程：

- 首页 payload
- 实体筛选
- 详情页聚合
- 注册冲突
- 角色登录
- 停用账号无法登录
- 提案提交与审批写回
- 结构化人物提案写回
- 后台用户角色提升
- 管理接口权限保护
- 快速创建条目

现在可直接运行：

```bash
npm --prefix /root/kunquwiki/apps/api run test:e2e
```

### 15.2 Web 测试

目前较轻，主要在 `apps/web/test`。

### 15.3 当前测试策略的含义

项目当前更偏重：

- API 业务主链路正确
- 构建可通过
- 前端页面在真实 API 契约下可构建

而不是大规模前端交互测试。

## 16. 演出官宣链接解析（新功能）

### 16.1 解析入口

- `POST /api/events/parse`
- 输入：`url`（官宣链接）或 `text`（已抓取并清洗后的正文）
- 输出：解析结果 + 匹配结果 + 未匹配列表 + 警告提示

### 16.2 解析流程

1. 抓取 HTML（自动处理受保护页面，必要时使用 Playwright）
2. 清洗正文（对公众号等页面优先取 `#js_content`）
3. AI 解析（JSON 严格输出）
4. 规则解析补充兜底
5. 与数据库进行实体匹配（城市、场馆、剧团、剧目、角色、演员）
6. 前端预览弹窗展示解析结果，用户确认后再写入表单

### 16.3 AI Provider 配置

后端支持 OpenAI-compatible API，可通过环境变量配置：

- `AI_PROVIDER`：当前实现为 `openai-compatible`
- `AI_API_BASE`：API base（兼容 OpenAI）
- `AI_API_KEY`
- `AI_MODEL`

### 16.4 脚本辅助

`apps/api/scripts/README.md` 提供：

- HTML 抓取（Playwright）
- 本地解析测试

## 17. 当前代码状态下的重要实现结论

### 16.1 已完成

- 统一实体模型
- 列表页与详情页主链路
- 引用来源和标签展示
- 登录与基础鉴权
- 提案与审核流
- 版本历史与最近更改
- 后台用户管理
- `visitor` 排他逻辑
- `bot` 角色与开放接口
- 完整创建表单替代 quick create 主流程

### 17.2 当前仍需注意的地方

#### 1. `packages/shared` 与完整编辑模型还未完全统一

详情页类型共享得比较好，但完整编辑字段还主要在 `api-client.ts` 内声明。

#### 2. `quick-create-form.tsx` 仍然存在

它已经不是主路径，但仍是遗留代码，后续可以考虑删除或明确降级为实验组件。

#### 3. `role / lineage / topic` 尚未做成完整前台主路径

数据库已有预留，但页面与编辑工作流还没完全接上。

#### 4. 复杂结构字段已结构化，但仍有可优化空间

节目单、演员表、人物身份等已经使用结构化子表单，但仍可以继续优化体验（如批量导入、拖拽排序等）。

## 18. 建议的新开发者阅读顺序

如果你第一次接手这个仓库，建议按下面顺序阅读：

1. [apps/api/prisma/schema.prisma](/root/kunquwiki/apps/api/prisma/schema.prisma)
   先理解数据模型
2. [apps/api/src/app.controller.ts](/root/kunquwiki/apps/api/src/app.controller.ts)
   看 API 面
3. [apps/api/src/content.repository.ts](/root/kunquwiki/apps/api/src/content.repository.ts)
   看真正的业务逻辑核心
4. [apps/web/lib/api.ts](/root/kunquwiki/apps/web/lib/api.ts)
   看服务端页面如何取数
5. [apps/web/lib/api-client.ts](/root/kunquwiki/apps/web/lib/api-client.ts)
   看客户端表单如何调用 API
6. [apps/web/components/forms/edit-proposal-form.tsx](/root/kunquwiki/apps/web/components/forms/edit-proposal-form.tsx)
   看完整创建/编辑表单
7. `apps/web/app/*`
   看页面路由如何组装展示组件

## 19. 一句话总结当前架构

当前 KunquWiki 是一个以 `Entity` 为统一公开入口、以 `ContentRepository` 为业务核心、以“提案审核后写回”为内容治理机制、以 Next.js 页面消费 NestJS 聚合 API 的垂直知识站原型。
