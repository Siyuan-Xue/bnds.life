import Link from "next/link";
import type { Video } from "~/lib/videos";
import { groupVideosByMonth, type TimelineOrder } from "~/lib/video-timeline";
import { Icon } from "./icon";
import { VideoCard } from "./video-card";

export function VideoTimeline({
  videos,
  order = "desc",
  showSortControls = false,
}: {
  videos: Video[];
  order?: TimelineOrder;
  showSortControls?: boolean;
}) {
  return (
    <div className="video-timeline">
      {showSortControls && (
        <nav className="timeline-sort" aria-label="首页视频排列方式">
          <Link
            href="/"
            scroll={false}
            aria-current={order === "desc" ? "true" : undefined}
          >
            <Icon name="sort" />
            <span>从新到旧</span>
          </Link>
          <Link
            href="/?order=asc"
            scroll={false}
            aria-current={order === "asc" ? "true" : undefined}
          >
            <Icon name="sort" className="timeline-sort-ascending" />
            <span>从旧到新</span>
          </Link>
        </nav>
      )}
      {groupVideosByMonth(videos, order).map(({ month, videos }) => {
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
