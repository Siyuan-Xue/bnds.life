import type { Video } from "./videos";

export function preferredSource(
  video: Pick<Video, "source" | "contentType">,
  canPlayType: (contentType: string) => string,
): string | undefined {
  return video.contentType && !canPlayType(video.contentType)
    ? undefined
    : video.source;
}
