import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AppService } from "./app.service";
import { CreateProposalDto, QuickCreateEntityDto, ReviewProposalDto, UpdateUserAccessDto } from "./dto";

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
  getModerationQueue(@Headers("authorization") authorization?: string) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertReviewerRole(user);
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
  createQuickEntity(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: QuickCreateEntityDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertEditorRole(user);
    return this.appService.createQuickEntity(body, user.sub);
  }

  @Post("open/entities")
  createOpenEntity(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: QuickCreateEntityDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertAutomationRole(user);
    return this.appService.createQuickEntity(body, user.sub);
  }

  @Post("open/entities/:slug/proposals")
  createOpenProposal(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateProposalDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertAutomationRole(user);
    return this.appService.createProposal(slug, user.sub, body);
  }

  @Get("admin/overview")
  getAdminOverview(@Headers("authorization") authorization?: string) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertAdminRole(user);
    return this.appService.getAdminOverview();
  }

  @Get("admin/users")
  getAdminUsers(@Headers("authorization") authorization?: string) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertAdminRole(user);
    return this.authService.listUsers();
  }

  @Patch("admin/users/:id")
  updateAdminUser(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateUserAccessDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertAdminRole(user);
    return this.authService.updateUserAccess(id, body, user.sub);
  }

  @Post("entities/:slug/proposals")
  createProposal(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateProposalDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertEditorRole(user);
    return this.appService.createProposal(slug, user.sub, body);
  }

  @Patch("moderation/proposals/:id")
  reviewProposal(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ReviewProposalDto
  ) {
    const user = this.authService.verifyToken(authorization);
    this.authService.assertReviewerRole(user);
    return this.appService.reviewProposal(id, user.sub, body);
  }
}
