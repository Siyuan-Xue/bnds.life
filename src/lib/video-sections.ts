import type { Video } from "./videos";

export function isShortVideo(video: Pick<Video, "duration">): boolean {
  return (
    Number.isFinite(video.duration) &&
    video.duration > 0 &&
    video.duration <= 60
  );
}

export function isHomeVideo(video: Pick<Video, "duration">): boolean {
  return Number.isFinite(video.duration) && video.duration > 60;
}
