import { and, eq } from "drizzle-orm";
import { mediaAssetKey } from "~/lib/media-access";
import { db } from "~/server/db";
import { mediaVideos, videoAssets } from "~/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const asset = mediaAssetKey(request.headers.get("x-original-uri") ?? "");
  if (!asset) return new Response(null, { status: 403 });
  const rows = await db
    .select({ id: videoAssets.id })
    .from(videoAssets)
    .innerJoin(mediaVideos, eq(mediaVideos.id, videoAssets.videoId))
    .where(
      and(
        eq(mediaVideos.status, "published"),
        eq(mediaVideos.id, asset.videoId),
        eq(videoAssets.kind, asset.kind),
        eq(videoAssets.objectKey, asset.key),
      ),
    )
    .limit(1);
  return new Response(null, {
    status: rows.length ? 204 : 403,
    headers: { "Cache-Control": "no-store" },
  });
}
