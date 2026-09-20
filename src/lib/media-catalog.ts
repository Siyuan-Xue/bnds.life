import type { Video } from "./videos";
import { normalizeRecordedDate } from "./recorded-date.ts";

type CatalogRow = {
  id: string;
  title: string;
  story: string | null;
  recordedDate: string | null;
  status: string;
};
type AssetRow = {
  kind: string;
  objectKey: string;
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
  const safe = (key: string, prefix: string) =>
    key.startsWith(prefix) &&
    /^[a-zA-Z0-9/_\-.]+$/.test(key) &&
    !key.split("/").some((p) => p === "." || p === "..");
  if (
    !playback ||
    !poster ||
    !safe(playback.objectKey, "playback/") ||
    !safe(poster.objectKey, "posters/") ||
    !playback.durationMs ||
    playback.durationMs <= 0
  )
    return undefined;
  const recordedAt = normalizeRecordedDate(row.recordedDate);
  const native = assets.find((a) => a.kind === "native");
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
    duration: playback.durationMs / 1000,
    source: `/media/${playback.objectKey}`,
    ...(nativeSource ? { nativeSource } : {}),
    poster: `/media/${poster.objectKey}`,
    ...(row.story ? { story: row.story } : {}),
    ...(recordedAt ? { recordedAt } : {}),
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
