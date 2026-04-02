import { SeedDiscussionThread } from "../types";
import { SeedContext } from "../utils/entity";
import { parseOptionalDate } from "../utils/date";

export async function importDiscussions(ctx: SeedContext, discussions: SeedDiscussionThread[]) {
  for (const thread of discussions) {
    const entityId = ctx.entityIdBySlug.get(thread.entitySlug);
    if (!entityId) throw new Error(`Unknown entitySlug ${thread.entitySlug} in discussions`);
    const createdById = ctx.userByUsername.get(thread.createdByUsername);
    if (!createdById) throw new Error(`Unknown createdByUsername ${thread.createdByUsername} in discussions`);

    const created = await ctx.prisma.discussionThread.create({
      data: {
        entityId,
        title: thread.title,
        createdById,
        status: thread.status ?? "open",
        createdAt: parseOptionalDate(thread.createdAt) ?? undefined
      }
    });

    if (thread.posts?.length) {
      for (const post of thread.posts) {
        const authorId = ctx.userByUsername.get(post.authorUsername);
        if (!authorId) throw new Error(`Unknown authorUsername ${post.authorUsername} in discussions.posts`);
        await ctx.prisma.discussionPost.create({
          data: {
            threadId: created.id,
            authorId,
            body: post.body,
            createdAt: parseOptionalDate(post.createdAt) ?? undefined
          }
        });
      }
    }
  }
}
