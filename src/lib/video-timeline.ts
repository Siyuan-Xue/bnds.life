import type { Video } from "./videos";
import { normalizeRecordedDate } from "./recorded-date.ts";

export type VideoMonth = { month: string | null; videos: Video[] };
export type TimelineOrder = "asc" | "desc";

function validRecordedDate(value: string | undefined): string | undefined {
  const date = normalizeRecordedDate(value);
  return date && date.length >= 7 ? date : undefined;
}

function validRecordedTime(value: string | undefined): string | undefined {
  return value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

export function groupVideosByMonth(
  videos: Video[],
  order: TimelineOrder = "desc",
): VideoMonth[] {
  const direction = order === "asc" ? 1 : -1;
  const groups = new Map<
    string | null,
    { video: Video; date?: string; time?: string; index: number }[]
  >();
  videos.forEach((video, index) => {
    const date = validRecordedDate(video.recordedAt);
    const month = date?.slice(0, 7) ?? null;
    const entry = {
      video,
      date,
      time:
        date?.length === 10 ? validRecordedTime(video.recordedTime) : undefined,
      index,
    };
    const group = groups.get(month);
    if (group) group.push(entry);
    else groups.set(month, [entry]);
  });
  return Array.from(groups, ([month, entries]) => ({
    month,
    videos: entries
      .sort((a, b) => {
        // A month-only date or unknown clock cannot be placed precisely among
        // fully dated videos, so keep it after known timestamps in either view.
        const preciseA = a.date?.length === 10;
        const preciseB = b.date?.length === 10;
        if (preciseA !== preciseB) return preciseA ? -1 : 1;
        const byDate = direction * (a.date ?? "").localeCompare(b.date ?? "");
        if (byDate) return byDate;
        if (Boolean(a.time) !== Boolean(b.time)) return a.time ? -1 : 1;
        const byTime = direction * (a.time ?? "").localeCompare(b.time ?? "");
        return byTime || a.index - b.index;
      })
      .map(({ video }) => video),
  })).sort((a, b) => {
    if (a.month === null && b.month === null) return 0;
    if (a.month === null) return 1;
    if (b.month === null) return -1;
    return direction * a.month.localeCompare(b.month);
  });
}
