import type { Video } from "./videos";

export type VideoMonth = { month: string | null; videos: Video[] };

function validRecordedDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10) === value ? value : undefined;
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
