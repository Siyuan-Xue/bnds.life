import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { mediaVideos, videoAssets } from "~/server/db/schema";
import {
  listVideos as demoList,
  recommendVideos as demoRecommend,
  type Video,
} from "~/lib/videos";
import { publicVideo, orderRecommendations } from "~/lib/media-catalog";
import { isHomeVideo, isShortVideo } from "~/lib/video-sections";

export async function listVideos(query = ""): Promise<Video[]> {
  if (env.VIDEO_CATALOG_MODE === "demo") return demoList(query);
  const rows = await db
    .select()
    .from(mediaVideos)
    .where(eq(mediaVideos.status, "published"))
    .orderBy(desc(mediaVideos.recordedDate), asc(mediaVideos.id));
  if (!rows.length) return [];
  const assets = await db
    .select({
      videoId: videoAssets.videoId,
      kind: videoAssets.kind,
      originalFilename: videoAssets.originalFilename,
      objectKey: videoAssets.objectKey,
      durationMs: videoAssets.durationMs,
      metadata: videoAssets.metadata,
    })
    .from(videoAssets)
    .where(
      inArray(
        videoAssets.videoId,
        rows.map((r) => r.id),
      ),
    );
  const normalized = query.trim().toLocaleLowerCase();
  return rows
    .map((row) =>
      publicVideo(
        row,
        assets.filter((a) => a.videoId === row.id),
      ),
    )
    .filter(
      (video): video is Video =>
        !!video && video.title.toLocaleLowerCase().includes(normalized),
    );
}

export async function findVideo(id: string): Promise<Video | undefined> {
  return (await listVideos()).find((video) => video.id === id);
}

export async function listHomeVideos(query = ""): Promise<Video[]> {
  return (await listVideos(query)).filter(isHomeVideo);
}

export async function recommendVideos(startId?: string): Promise<Video[]> {
  if (env.VIDEO_CATALOG_MODE === "demo")
    return demoRecommend(startId).filter(isShortVideo);
  return orderRecommendations(
    (await listVideos()).filter(isShortVideo),
    startId,
  );
}
