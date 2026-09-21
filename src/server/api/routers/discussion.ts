import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  createCommunity,
  listInput,
  commentInput,
  storyInput,
} from "~/server/community";
export const discussionRouter = createTRPCRouter({
  saveStory: protectedProcedure
    .input(storyInput)
    .mutation(({ ctx, input }) =>
      createCommunity(ctx.db).saveStory(ctx.session.user.id, input),
    ),
  viewer: publicProcedure.query(({ ctx }) =>
    createCommunity(ctx.db).viewer(ctx.session?.user.id),
  ),
  list: publicProcedure
    .input(listInput)
    .query(({ ctx, input }) => createCommunity(ctx.db).list(input)),
  stories: publicProcedure
    .input(z.object({ videoId: z.string().max(100) }))
    .query(({ ctx, input }) => createCommunity(ctx.db).stories(input.videoId)),
  add: protectedProcedure
    .input(commentInput)
    .mutation(({ ctx, input }) =>
      createCommunity(ctx.db).add(ctx.session.user.id, input),
    ),
});
