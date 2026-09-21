import type { Video } from "~/lib/videos";

export function VideoDate({
  video,
}: {
  video: Pick<Video, "recordedAt" | "recordedTime">;
}) {
  if (!video.recordedAt) return <>日期待补充</>;
  return (
    <time
      dateTime={
        video.recordedTime
          ? `${video.recordedAt}T${video.recordedTime}`
          : video.recordedAt
      }
    >
      {video.recordedAt}
      {video.recordedTime ? ` ${video.recordedTime}` : ""}
    </time>
  );
}
