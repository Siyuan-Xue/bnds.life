import type { Video } from "~/lib/videos";
import { groupVideosByMonth } from "~/lib/video-timeline";
import { VideoCard } from "./video-card";

export function VideoTimeline({ videos }: { videos: Video[] }) {
  return (
    <div className="video-timeline">
      {groupVideosByMonth(videos).map(({ month, videos }) => {
        const headingId = `month-${month ?? "unknown"}`;
        return (
          <section
            className="timeline-month"
            key={month ?? "unknown"}
            aria-labelledby={headingId}
          >
            <div className="month-heading">
              <h2 id={headingId}>
                {month ? (
                  <time dateTime={month}>
                    {month.slice(0, 4)}年{Number(month.slice(5))}月
                  </time>
                ) : (
                  "时间待补充"
                )}
              </h2>
            </div>
            <div className="video-grid">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} returnHome />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
