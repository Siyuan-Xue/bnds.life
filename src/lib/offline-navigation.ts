import type { Video } from "./videos";
import { isHomeVideo } from "./video-sections.ts";

export function destinationAfterOffline(
  video: Pick<Video, "id" | "duration" | "recordedAt">,
  nextShortVideoId?: string,
  hasHomePosition = false,
  homeOrder: "asc" | "desc" = "desc",
): string {
  if (isHomeVideo(video)) {
    const home = homeOrder === "asc" ? "/?order=asc" : "/";
    if (hasHomePosition) return home;
    const month = /^\d{4}-(0[1-9]|1[0-2])/.exec(video.recordedAt ?? "")?.[0];
    return month ? `${home}#month-${month}` : home;
  }
  return nextShortVideoId && nextShortVideoId !== video.id
    ? `/recommend?v=${encodeURIComponent(nextShortVideoId)}`
    : "/recommend";
}
