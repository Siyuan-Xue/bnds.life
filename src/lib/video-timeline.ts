import type { Video } from "./videos";
import { normalizeRecordedDate } from "./recorded-date.ts";

export type VideoMonth = { month: string | null; videos: Video[] };

function validRecordedDate(value: string | undefined): string | undefined {
  const date = normalizeRecordedDate(value);
  return date && date.length >= 7 ? date : undefined;
}

export function groupVideosByMonth(videos: Video[]): VideoMonth[] {
  const dated = videos
    .map((video) => ({ video, date: validRecordedDate(video.recordedAt) }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const groups = new Map<string | null, Video[]>();
  for (const { video, date } of dated) {
    const month = date?.slice(0, 7) ?? null;
    const group = groups.get(month);
    if (group) group.push(video);
    else groups.set(month, [video]);
  }
  return Array.from(groups, ([month, videos]) => ({ month, videos }));
}
