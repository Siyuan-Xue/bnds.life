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
  // Transcoding can add or remove a tail frame. Keep classification tied to
  // the source's stored milliseconds, with playback as the legacy fallback.
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
  // A native-only import stores its primary lossless file as playback.
  const native = assets.find((a) => a.kind === "native") ?? playback;
  const contentType =
    native?.metadata &&
    typeof native.metadata === "object" &&
    "contentType" in native.metadata
      ? native.metadata.contentType
      : undefined;
  const nativeSource =
    native &&
    safe(native.objectKey, "playback/") &&
    typeof contentType === "string" &&
    /^video\/mp4; codecs="(?:hvc1(?:\.[A-C]?\d+\.[A-F0-9]+\.[LH]\d+(?:\.[A-F0-9]{1,2}){1,6})?|avc1(?:\.[A-F0-9]{6})?)(?:, mp4a\.40\.2)?"$/.test(
      contentType,
    )
      ? { url: `/media/${native.objectKey}`, contentType }
      : undefined;
  return {
    id: row.id,
    title: row.title,
    duration,
    source: `/media/${playback.objectKey}`,
    ...(nativeSource ? { nativeSource } : {}),
    poster: `/media/${poster.objectKey}`,
    ...(row.story ? { story: row.story } : {}),
    ...(recordedAt ? { recordedAt } : {}),
    ...(recordedTime ? { recordedTime } : {}),
    ...(row.isFeatured && isHomeVideo({ duration })
      ? { isFeatured: true }
      : {}),
  };
}

export function orderRecommendations<T extends { id: string }>(
  videos: T[],
  startId?: string,
): T[] {
  // Stable ordering independent of dates, without splitting the catalog by aspect ratio.
  const hash = (value: string) =>
    Array.from(value).reduce(
      (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    );
  const sorted = [...videos].sort(
    (a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id),
  );
  const start = sorted.findIndex((v) => v.id === startId);
  return start > 0
    ? [...sorted.slice(start), ...sorted.slice(0, start)]
    : sorted;
}
