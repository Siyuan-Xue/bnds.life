import Image from "next/image";
import Link from "next/link";
import { formatDuration, type Video } from "~/lib/videos";

export function VideoCard({
  video,
  compact = false,
}: {
  video: Video;
  compact?: boolean;
}) {
  return (
    <article className={`video-card ${compact ? "compact-card" : ""}`}>
      <Link
        className="thumbnail"
        href={`/watch/${video.id}`}
        aria-label={`观看：${video.title}`}
      >
        <Image
          src={video.poster}
          alt=""
          width={1280}
          height={720}
          unoptimized
        />
        <span className="preview-badge">占位预览</span>
        <span className="duration">{formatDuration(video.duration)}</span>
      </Link>
      <div className="video-card-info">
        {!compact && (
          <span className="avatar" aria-hidden="true">
            十
          </span>
        )}
        <div className="video-card-copy">
          <h2>
            <Link href={`/watch/${video.id}`}>{video.title}</Link>
          </h2>
          <p>{video.author}</p>
          <p>示例视频</p>
        </div>
      </div>
    </article>
  );
}
