import { SeedRevision } from "../types";
import { SeedContext } from "../utils/entity";
import { parseOptionalDate } from "../utils/date";

export async function importRevisions(ctx: SeedContext, revisions: SeedRevision[]) {
  for (const revision of revisions) {
    const entityId = ctx.entityIdBySlug.get(revision.entitySlug);
    if (!entityId) throw new Error(`Unknown entitySlug ${revision.entitySlug} in revisions`);
    const editorId = ctx.userByUsername.get(revision.editorUsername);
    if (!editorId) throw new Error(`Unknown editorUsername ${revision.editorUsername} in revisions`);
    const reviewerId = revision.reviewerUsername ? ctx.userByUsername.get(revision.reviewerUsername) ?? null : null;

    await ctx.prisma.entityRevision.create({
      data: {
        entityId,
        revisionNo: revision.revisionNo,
        title: revision.title,
        bodyMarkdown: revision.bodyMarkdown ?? null,
        structuredDataJson: revision.structuredDataJson ?? undefined,
        editSummary: revision.editSummary,
        reviewStatus: revision.reviewStatus,
        editorId,
        reviewerId,
        reviewedAt: parseOptionalDate(revision.reviewedAt) ?? null,
        createdAt: parseOptionalDate(revision.createdAt) ?? undefined
      }
    });
  }
}
