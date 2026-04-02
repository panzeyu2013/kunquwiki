import { SeedProposal } from "../types";
import { SeedContext } from "../utils/entity";
import { parseOptionalDate } from "../utils/date";

export async function importProposals(ctx: SeedContext, proposals: SeedProposal[]) {
  for (const proposal of proposals) {
    const proposerId = ctx.userByUsername.get(proposal.proposerUsername);
    if (!proposerId) throw new Error(`Unknown proposerUsername ${proposal.proposerUsername} in proposals`);
    const reviewerId = proposal.reviewerUsername ? ctx.userByUsername.get(proposal.reviewerUsername) ?? null : null;
    const entityId = proposal.entitySlug ? ctx.entityIdBySlug.get(proposal.entitySlug) ?? null : null;

    await ctx.prisma.editProposal.create({
      data: {
        entityId,
        targetEntityType: proposal.targetEntityType ?? undefined,
        proposerId,
        proposalType: proposal.proposalType,
        payloadJson: proposal.payloadJson,
        status: proposal.status ?? undefined,
        reviewerId,
        reviewComment: proposal.reviewComment ?? null,
        reviewedAt: parseOptionalDate(proposal.reviewedAt) ?? null,
        createdAt: parseOptionalDate(proposal.createdAt) ?? undefined
      }
    });
  }
}
