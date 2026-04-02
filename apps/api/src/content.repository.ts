import { Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { createQuickEntity, deleteEntity, findEntityByTypeAndTitle, getEditorOptions } from "./content/content.editor";
import { createEntityProposal, createProposal, reviewProposal } from "./content/content.proposals";
import {
  getAdminOverview,
  getEntityBySlug,
  getHomePayload,
  getModerationQueue,
  getRecentChanges,
  getStats,
  listEntities,
  search,
  type ListEntitiesParams
} from "./content/content.query";
import { PrismaService } from "./prisma.service";
import { SearchIndexService } from "./search-index.service";
import { parseEventAnnouncementLink } from "./content/event-link.parser";

@Injectable()
export class ContentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService
  ) {}

  async getHomePayload() {
    return getHomePayload(this.prisma);
  }

  async listEntities(params?: ListEntitiesParams) {
    return listEntities(this.prisma, params);
  }

  async getEntityBySlug(slug: string) {
    return getEntityBySlug(this.prisma, slug);
  }

  async search(query: string, type?: string) {
    return search(this.prisma, query, type);
  }

  async getRecentChanges() {
    return getRecentChanges(this.prisma);
  }

  async getModerationQueue() {
    return getModerationQueue(this.prisma);
  }


  async getStats() {
    return getStats(this.prisma);
  }


  async getAdminOverview() {
    return getAdminOverview(this.prisma);
  }

  async createProposal(slug: string, proposerId: string, payload: { proposalType: string; editSummary: string; payload: Record<string, unknown> }) {
    return createProposal(this.prisma, slug, proposerId, payload);
  }

  async createEntityProposal(input: {
    entityType: EntityType;
    proposalType: string;
    editSummary: string;
    payload: Record<string, unknown>;
  }, proposerId: string) {
    return createEntityProposal(this.prisma, proposerId, input);
  }

  async reviewProposal(id: string, reviewerId: string, decision: "approved" | "rejected", reviewComment?: string) {
    return reviewProposal(this.prisma, this.searchIndex, id, reviewerId, decision, reviewComment);
  }

  async getEditorOptions(entityType?: string, excludeEntityId?: string) {
    return getEditorOptions(this.prisma, entityType, excludeEntityId);
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
    return createQuickEntity(this.prisma, this.searchIndex, input, createdById);
  }

  async findEntityByTypeAndTitle(entityType: EntityType, title: string) {
    return findEntityByTypeAndTitle(this.prisma, entityType, title);
  }

  async deleteEntity(entityId: string, actorId: string) {
    return deleteEntity(this.prisma, entityId, actorId);
  }

  async parseEventLink(url: string) {
    return parseEventAnnouncementLink(url);
  }
}
