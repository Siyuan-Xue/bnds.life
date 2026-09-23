import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { db as database } from "./db/index";
import {
  mediaVideos,
  videoAssets,
  user,
  videoComments,
  videoDeletionJobs,
} from "./db/schema.ts";
import { normalizeRecordedDate } from "../lib/recorded-date.ts";
import { publicVideo } from "../lib/media-catalog.ts";
import { isHomeVideo } from "../lib/video-sections.ts";

export const commentInput = z.object({
  videoId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(5000),
});
export const storyInput = z.object({
  videoId: z.string().uuid(),
  id: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(100000),
});
export const listInput = z.object({
  videoId: z.string().max(100),
  parentId: z.string().uuid().optional(),
  cursor: z
    .object({ createdAt: z.string().datetime(), id: z.string().uuid() })
    .optional(),
});
export const updateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  recordedAt: z
    .string()
    .nullable()
    .refine(
      (v) => v === null || !!normalizeRecordedDate(v),
      "请输入有效的拍摄日期",
    ),
});
export const featuredInput = z.object({
  id: z.string().uuid(),
  isFeatured: z.boolean(),
});
const bad = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
const idValid = (id: string) => z.string().uuid().safeParse(id).success;

export function createCommunity(db: typeof database) {
  async function viewer(id?: string | null) {
    if (!id) return null;
    const [found] = await db
      .select({ id: user.id, name: user.name, isOfficial: user.isOfficial })
      .from(user)
      .where(eq(user.id, id));
    return found ?? null;
  }
  async function member(id?: string | null) {
    const found = await viewer(id);
    if (!found)
      throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
    return found;
  }
  async function official(id?: string | null) {
    const found = await member(id);
    if (!found.isOfficial)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "仅官方账户可以管理视频",
      });
    return found;
  }
  const selection = {
    id: videoComments.id,
    videoId: videoComments.videoId,
    parentId: videoComments.parentId,
    body: videoComments.body,
    createdAt: videoComments.createdAt,
    author: { id: user.id, name: user.name, isOfficial: user.isOfficial },
    replyCount: sql<number>`(select count(*)::int from video_comments replies where replies.parent_id = ${videoComments.id})`,
  };
  async function list(input: z.infer<typeof listInput>, stories = false) {
    if (!idValid(input.videoId)) return { items: [], nextCursor: null };
    const rows = await db
      .select(selection)
      .from(videoComments)
      .innerJoin(user, eq(videoComments.userId, user.id))
      .innerJoin(mediaVideos, eq(videoComments.videoId, mediaVideos.id))
      .where(
        and(
          eq(videoComments.videoId, input.videoId),
          eq(mediaVideos.status, "published"),
          input.parentId
            ? eq(videoComments.parentId, input.parentId)
            : and(
                isNull(videoComments.parentId),
                eq(videoComments.isStory, stories),
              ),
          input.cursor
            ? or(
                lt(videoComments.createdAt, new Date(input.cursor.createdAt)),
                and(
                  eq(videoComments.createdAt, new Date(input.cursor.createdAt)),
                  lt(videoComments.id, input.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(videoComments.createdAt), desc(videoComments.id))
      .limit(stories ? 1 : 21);
    const more = !stories && rows.length > 20;
    const items = (more ? rows.slice(0, 20) : rows).map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        more && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
  return {
    viewer,
    list,
    async offlineVideos(userId: string | null | undefined) {
      await official(userId);
      const jobs = await db
        .select()
        .from(videoDeletionJobs)
        .orderBy(
          sql`CASE WHEN ${videoDeletionJobs.status} = 'failed' THEN 0 WHEN ${videoDeletionJobs.status} IN ('pending','running') THEN 1 ELSE 2 END`,
          desc(videoDeletionJobs.createdAt),
        )
        .limit(100);
      return jobs.map((job) => ({
        jobId: job.id,
        videoId: job.videoId,
        title: job.videoTitle,
        status: job.status,
        error:
          job.status === "failed"
            ? "资源尚未清理，下次定时任务将自动重试"
            : null,
        createdAt: job.createdAt.toISOString(),
      }));
    },
    stories: async (videoId: string) => (await list({ videoId }, true)).items,
    async saveStory(
      userId: string | null | undefined,
      raw: z.infer<typeof storyInput>,
    ) {
      const actor = await official(userId);
      const parsed = storyInput.safeParse(raw);
      if (!parsed.success) throw bad("故事需为 1–100000 个字符");
      const input = parsed.data;
      return db.transaction(async (tx) => {
        const [video] = await tx
          .select({ id: mediaVideos.id })
          .from(mediaVideos)
          .where(
            and(
              eq(mediaVideos.id, input.videoId),
              eq(mediaVideos.status, "published"),
            ),
          )
          .for("update");
        if (!video)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "视频不存在或已下线",
          });
        const [existing] = await tx
          .select()
          .from(videoComments)
          .where(
            and(
              eq(videoComments.videoId, input.videoId),
              eq(videoComments.isStory, true),
            ),
          );
        if (existing) {
          if (input.id !== existing.id)
            throw new TRPCError({
              code: "CONFLICT",
              message: "这个视频已有故事，请编辑现有故事",
            });
          await tx
            .update(videoComments)
            .set({ body: input.body })
            .where(eq(videoComments.id, existing.id));
          return { id: existing.id };
        }
        if (input.id)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "故事不存在，请刷新页面",
          });
        const id = randomUUID();
        await tx.insert(videoComments).values({
          id,
          videoId: input.videoId,
          userId: actor.id,
          body: input.body,
          isStory: true,
        });
        return { id };
      });
    },
    async add(
      userId: string | null | undefined,
      raw: z.infer<typeof commentInput>,
    ) {
      const actor = await member(userId);
      if (actor.isOfficial)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "官方账户只能编辑故事，不能发表评论或回复",
        });
      const parsed = commentInput.safeParse(raw);
      if (!parsed.success) throw bad("评论需为 1–5000 个字符");
      const input = parsed.data;
      return db.transaction(async (tx) => {
        // Serialize per account, so concurrent requests cannot bypass the posting interval.
        await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, actor.id))
          .for("update");
        const [video] = await tx
          .select({ id: mediaVideos.id })
          .from(mediaVideos)
          .where(
            and(
              eq(mediaVideos.id, input.videoId),
              eq(mediaVideos.status, "published"),
            ),
          )
          .for("share");
        if (!video)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "视频不存在或已下线",
          });
        let parentId = input.parentId;
        if (parentId) {
          const [parent] = await tx
            .select()
            .from(videoComments)
            .where(
              and(
                eq(videoComments.id, parentId),
                eq(videoComments.videoId, input.videoId),
              ),
            );
          if (!parent) throw bad("回复的评论不属于该视频");
          if (parent.isStory) throw bad("故事只供阅读，请在评论区发表评论");
          parentId = parent.parentId ?? parent.id;
        }
        const [last] = await tx
          .select({ createdAt: videoComments.createdAt })
          .from(videoComments)
          .where(eq(videoComments.userId, actor.id))
          .orderBy(desc(videoComments.createdAt))
          .limit(1);
        if (last && Date.now() - last.createdAt.getTime() < 5000)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "发送太快了，请稍等几秒",
          });
        const id = randomUUID();
        await tx.insert(videoComments).values({
          id,
          videoId: input.videoId,
          userId: actor.id,
          parentId,
          body: input.body,
        });
        return { id };
      });
    },
    async update(
      userId: string | null | undefined,
      raw: z.infer<typeof updateInput>,
    ) {
      await official(userId);
      const parsed = updateInput.safeParse(raw);
      if (!parsed.success) throw bad("请检查视频名称和拍摄日期");
      const input = parsed.data;
      const [row] = await db
        .update(mediaVideos)
        .set({
          title: input.title,
          recordedDate: input.recordedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mediaVideos.id, input.id),
            eq(mediaVideos.status, "published"),
          ),
        )
        .returning({
          id: mediaVideos.id,
          title: mediaVideos.title,
          recordedAt: mediaVideos.recordedDate,
        });
      if (!row)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "视频不存在或已下线",
        });
      return row;
    },
    async setFeatured(
      userId: string | null | undefined,
      raw: z.infer<typeof featuredInput>,
    ) {
      await official(userId);
      const parsed = featuredInput.safeParse(raw);
      if (!parsed.success) throw bad("请检查视频和经典状态");
      const input = parsed.data;
      return db.transaction(async (tx) => {
        // Share the offline operation's row lock so a waiting feature request
        // rechecks the latest publication state before making a change.
        const [row] = await tx
          .select()
          .from(mediaVideos)
          .where(
            and(
              eq(mediaVideos.id, input.id),
              eq(mediaVideos.status, "published"),
            ),
          )
          .for("update");
        if (!row)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "视频不存在或已下线",
          });
        if (input.isFeatured) {
          const assets = await tx
            .select()
            .from(videoAssets)
            .where(eq(videoAssets.videoId, input.id));
          const video = publicVideo(row, assets);
          if (!video || !isHomeVideo(video))
            throw bad("仅超过 60 秒的已发布视频可以加入首页经典");
        }
        await tx
          .update(mediaVideos)
          .set({ isFeatured: input.isFeatured, updatedAt: new Date() })
          .where(eq(mediaVideos.id, input.id));
        return { isFeatured: input.isFeatured };
      });
    },
    async offline(userId: string | null | undefined, id: string) {
      const actor = await official(userId);
      return db.transaction(async (tx) => {
        const [video] = await tx
          .select()
          .from(mediaVideos)
          .where(eq(mediaVideos.id, id))
          .for("update");
        const [existing] = await tx
          .select()
          .from(videoDeletionJobs)
          .where(eq(videoDeletionJobs.videoId, id));
        if (existing) {
          if (video?.status === "published") {
            await tx
              .update(mediaVideos)
              .set({ status: "hidden", updatedAt: new Date() })
              .where(eq(mediaVideos.id, id));
            await tx
              .update(videoDeletionJobs)
              .set({
                status: "pending",
                error: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoTitle: video.title,
              })
              .where(eq(videoDeletionJobs.id, existing.id));
            return { jobId: existing.id, status: "pending" as const };
          }
          return {
            jobId: existing.id,
            status: existing.status,
          };
        }
        if (!video)
          throw new TRPCError({ code: "NOT_FOUND", message: "视频不存在" });
        await tx
          .update(mediaVideos)
          .set({ status: "hidden", updatedAt: new Date() })
          .where(eq(mediaVideos.id, id));
        const jobId = randomUUID();
        await tx.insert(videoDeletionJobs).values({
          id: jobId,
          videoId: id,
          videoTitle: video.title,
          sourceSha256: video.sourceSha256,
          requestedBy: actor.id,
        });
        return { jobId, status: "pending" as const };
      });
    },
    async deletion(userId: string | null | undefined, jobId: string) {
      await official(userId);
      const [job] = await db
        .select()
        .from(videoDeletionJobs)
        .where(eq(videoDeletionJobs.id, jobId));
      if (!job)
        throw new TRPCError({ code: "NOT_FOUND", message: "删除任务不存在" });
      return {
        jobId: job.id,
        status: job.status,
        error:
          job.status === "failed" ? "文件清理未完成，请重试；视频已下线" : null,
      };
    },
  };
}
