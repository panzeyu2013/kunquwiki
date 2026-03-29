import { Injectable } from "@nestjs/common";
import { ContentRepository } from "./content.repository";
import { CreateProposalDto, QuickCreateEntityDto, ReviewProposalDto } from "./dto";

@Injectable()
export class AppService {
  constructor(private readonly repository: ContentRepository) {}

  getHomePayload() {
    return this.repository.getHomePayload();
  }

  listEntities(params?: {
    type?: string;
    q?: string;
    city?: string;
    status?: string;
    troupe?: string;
    person?: string;
    work?: string;
    venue?: string;
  }) {
    return this.repository.listEntities(params);
  }

  getEntityBySlug(slug: string) {
    return this.repository.getEntityBySlug(slug);
  }

  async search(query: string, type?: string) {
    return this.repository.search(query, type);
  }

  getRecentChanges() {
    return this.repository.getRecentChanges();
  }

  getModerationQueue() {
    return this.repository.getModerationQueue();
  }

  getStats() {
    return this.repository.getStats();
  }

  createProposal(slug: string, proposerId: string, body: CreateProposalDto) {
    return this.repository.createProposal(slug, proposerId, body);
  }

  reviewProposal(proposalId: string, reviewerId: string, body: ReviewProposalDto) {
    return this.repository.reviewProposal(proposalId, reviewerId, body.decision, body.reviewComment);
  }

  getAdminOverview() {
    return this.repository.getAdminOverview();
  }

  getEditorOptions(entityType?: string, excludeEntityId?: string) {
    return this.repository.getEditorOptions(entityType, excludeEntityId);
  }

  createQuickEntity(input: QuickCreateEntityDto, createdById: string) {
    return this.repository.createQuickEntity(input, createdById);
  }
}
