import type { Video } from "./videos";
import { isHomeVideo } from "./video-sections.ts";

export function destinationAfterOffline(
  video: Pick<Video, "id" | "duration" | "recordedAt">,
  nextShortVideoId?: string,
  hasHomePosition = false,
): string {
  if (isHomeVideo(video)) {
    if (hasHomePosition) return "/";
    const month = /^\d{4}-(0[1-9]|1[0-2])/.exec(video.recordedAt ?? "")?.[0];
    return month ? `/#month-${month}` : "/";
  }
  return nextShortVideoId && nextShortVideoId !== video.id
    ? `/recommend?v=${encodeURIComponent(nextShortVideoId)}`
    : "/recommend";
}
