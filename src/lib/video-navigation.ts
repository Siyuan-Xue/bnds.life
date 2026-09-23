import type { Video } from "./videos";
import { isHomeVideo, isShortVideo } from "./video-sections.ts";

export function videoPlaybackHref(
  video: Pick<Video, "id" | "duration">,
  fromHome = false,
): string {
  if (isShortVideo(video))
    return `/recommend?v=${encodeURIComponent(video.id)}`;
  return `/watch/${encodeURIComponent(video.id)}${fromHome ? "?from=home" : ""}`;
}

export function relatedLongVideos<T extends Pick<Video, "id" | "duration">>(
  current: T,
  videos: T[],
): T[] {
  return videos.filter(
    (video) => video.id !== current.id && isHomeVideo(video),
  );
}
