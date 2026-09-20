import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { findVideo, listVideos, recommendVideos } from "~/server/videos";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const videoRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ query: z.string().max(200).optional() }).optional())
    .query(({ input }) => listVideos(input?.query)),
  byId: publicProcedure
    .input(z.object({ id: z.string().max(100) }))
    .query(async ({ input }) => {
      const video = await findVideo(input.id);
      if (!video)
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到这段视频" });
      return video;
    }),
  recommended: publicProcedure.query(() => recommendVideos()),
});
