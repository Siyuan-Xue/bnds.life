import type { Video } from "./videos";

export function preferredSource(
  video: Pick<Video, "source" | "nativeSource">,
  canPlayType: (contentType: string) => string,
): string | undefined {
  if (
    video.nativeSource?.url === video.source &&
    !canPlayType(video.nativeSource.contentType)
  )
    return undefined;
  return video.nativeSource && canPlayType(video.nativeSource.contentType)
    ? video.nativeSource.url
    : video.source;
}

export function fallbackSource(
  video: Pick<Video, "source" | "nativeSource">,
  currentSource?: string,
): string | undefined {
  return currentSource === video.nativeSource?.url &&
    currentSource !== video.source
    ? video.source
    : undefined;
}
