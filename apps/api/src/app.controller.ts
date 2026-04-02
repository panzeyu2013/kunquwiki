import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AppService } from "./app.service";
import {
  CreateEntityProposalDto,
  CreateProposalDto,
  ParseEventLinkDto,
  QuickCreateEntityDto,
  ReviewProposalDto,
  UpdateUserAccessDto
} from "./dto";

@Controller("api")
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService
  ) {}

  @Get("health")
  getHealth() {
    return { ok: true, service: "kunquwiki-api" };
  }

  @Get("home")
  getHome() {
    return this.appService.getHomePayload();
  }

  @Get("entities")
  listEntities(
    @Query("type") type?: string,
    @Query("q") q?: string,
    @Query("city") city?: string,
    @Query("status") status?: string,
    @Query("troupe") troupe?: string,
    @Query("person") person?: string,
    @Query("work") work?: string,
    @Query("venue") venue?: string
  ) {
    return this.appService.listEntities({ type, q, city, status, troupe, person, work, venue });
  }

  @Get("entities/:slug")
  getEntity(@Param("slug") slug: string) {
    return this.appService.getEntityBySlug(slug);
  }

  @Get("search")
  search(@Query("q") query = "", @Query("type") type?: string) {
    return this.appService.search(query, type);
  }

  @Get("changes")
  getRecentChanges() {
    return this.appService.getRecentChanges();
  }

  @Get("moderation/queue")
  async getModerationQueue(@Headers("authorization") authorization?: string) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertReviewerRole(user.roles);
    return this.appService.getModerationQueue();
  }

  @Get("stats")
  getStats() {
    return this.appService.getStats();
  }

  @Get("editor/options")
  getEditorOptions(@Query("entityType") entityType?: string, @Query("excludeEntityId") excludeEntityId?: string) {
    return this.appService.getEditorOptions(entityType, excludeEntityId);
  }

  @Post("editor/quick-create")
  async createQuickEntity(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: QuickCreateEntityDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertEditorRole(user.roles);
    return this.appService.createQuickEntity(body, user.id);
  }

  @Post("open/entities")
  async createOpenEntity(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: QuickCreateEntityDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAutomationRole(user.roles);
    return this.appService.createQuickEntity(body, user.id);
  }

  @Post("entities/proposals")
  async createEntityProposal(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateEntityProposalDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertEditorRole(user.roles);
    return this.appService.createEntityProposal(body, user.id);
  }

  @Post("events/parse")
  async parseEventLink(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ParseEventLinkDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertEditorRole(user.roles);
    return this.appService.parseEventLink(body.url);
  }

  @Post("open/entities/:slug/proposals")
  async createOpenProposal(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateProposalDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAutomationRole(user.roles);
    return this.appService.createProposal(slug, user.id, body);
  }

  @Get("admin/overview")
  async getAdminOverview(@Headers("authorization") authorization?: string) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAdminRole(user.roles);
    return this.appService.getAdminOverview();
  }

  @Get("admin/users")
  async getAdminUsers(@Headers("authorization") authorization?: string) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAdminRole(user.roles);
    return this.authService.listUsers();
  }

  @Patch("admin/users/:id")
  async updateAdminUser(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateUserAccessDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAdminRole(user.roles);
    return this.authService.updateUserAccess(id, body, user.id);
  }

  @Delete("admin/entities/:id")
  async deleteEntity(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertAdminRole(user.roles);
    return this.appService.deleteEntity(id, user.id);
  }

  @Post("entities/:slug/proposals")
  async createProposal(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateProposalDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertEditorRole(user.roles);
    return this.appService.createProposal(slug, user.id, body);
  }

  @Patch("moderation/proposals/:id")
  async reviewProposal(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ReviewProposalDto
  ) {
    const user = await this.authService.requireActiveUser(authorization);
    this.authService.assertReviewerRole(user.roles);
    return this.appService.reviewProposal(id, user.id, body);
  }
}
