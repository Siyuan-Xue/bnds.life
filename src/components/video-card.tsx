import Image from "next/image";
import Link from "next/link";
import { formatDuration, type Video } from "~/lib/videos";

export function VideoCard({
  video,
  compact = false,
  tabIndex,
}: {
  video: Video;
  compact?: boolean;
  tabIndex?: number;
}) {
  const Heading = compact ? "h2" : "h3";
  return (
    <article className={`video-card ${compact ? "compact-card" : ""}`}>
      <Link
        className="thumbnail"
        href={`/watch/${video.id}`}
        aria-label={`观看：${video.title}`}
        tabIndex={tabIndex}
      >
        <Image
          src={video.poster}
          alt=""
          width={1280}
          height={720}
          unoptimized
        />
        {video.isDemo && <span className="preview-badge">占位预览</span>}
        <span className="duration">{formatDuration(video.duration)}</span>
      </Link>
      <div className="video-card-info">
        <div className="video-card-copy">
          <Heading>
            <Link href={`/watch/${video.id}`} tabIndex={tabIndex}>
              {video.title}
            </Link>
          </Heading>
          <p>
            {video.recordedAt ? (
              <time dateTime={video.recordedAt}>{video.recordedAt}</time>
            ) : (
              "日期待补充"
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
