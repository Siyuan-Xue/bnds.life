import type { Video } from "./videos";
import {
  normalizeRecordedDate,
  recordedTimeFromFilename,
} from "./recorded-date.ts";
import { isHomeVideo } from "./video-sections.ts";

type CatalogRow = {
  id: string;
  title: string;
  story: string | null;
  recordedDate: string | null;
  status: string;
  isFeatured?: boolean;
};
type AssetRow = {
  kind: string;
  objectKey: string;
  originalFilename?: string | null;
  durationMs?: number | null;
  metadata?: unknown;
};

export function publicVideo(
  row: CatalogRow,
  assets: AssetRow[],
): Video | undefined {
  if (row.status !== "published") return undefined;
  const playback = assets.find((a) => a.kind === "playback");
  const poster = assets.find((a) => a.kind === "poster");
  // Source metadata preserves the recording's precise section boundary.
  const durationMs = [
    assets.find((a) => a.kind === "original")?.durationMs,
    playback?.durationMs,
  ].find(
    (duration): duration is number =>
      typeof duration === "number" && Number.isFinite(duration) && duration > 0,
  );
  const safe = (key: string, prefix: string) =>
    key.startsWith(prefix) &&
    /^[a-zA-Z0-9/_\-.]+$/.test(key) &&
    !key.split("/").some((p) => p === "." || p === "..");
  if (
    !playback ||
    !poster ||
    !safe(playback.objectKey, "playback/") ||
    !safe(poster.objectKey, "posters/") ||
    durationMs === undefined
  )
    return undefined;
  const recordedAt = normalizeRecordedDate(row.recordedDate);
  const recordedTime =
    recordedAt?.length === 10
      ? recordedTimeFromFilename(
          assets.find((a) => a.kind === "original")?.originalFilename,
        )
      : undefined;
  const duration = durationMs / 1000;
  const contentType =
    playback.metadata &&
    typeof playback.metadata === "object" &&
    "contentType" in playback.metadata
      ? playback.metadata.contentType
      : undefined;
  const validContentType =
    typeof contentType === "string" &&
    /^video\/mp4; codecs="(?:hvc1(?:\.[A-C]?\d+\.[A-F0-9]+\.[LH]\d+(?:\.[A-F0-9]{1,2}){1,6})?|avc1(?:\.[A-F0-9]{6})?)(?:, mp4a\.40\.2)?"$/.test(
      contentType,
    );
  return {
    id: row.id,
    title: row.title,
    duration,
    source: `/media/${playback.objectKey}`,
    ...(validContentType ? { contentType } : {}),
    poster: `/media/${poster.objectKey}`,
    ...(row.story ? { story: row.story } : {}),
    ...(recordedAt ? { recordedAt } : {}),
    ...(recordedTime ? { recordedTime } : {}),
    ...(row.isFeatured && isHomeVideo({ duration })
      ? { isFeatured: true }
      : {}),
  };
}
