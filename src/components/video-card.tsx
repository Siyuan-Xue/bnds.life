import Image from "next/image";
import Link from "next/link";
import { formatDuration, type Video } from "~/lib/videos";
import { VideoDate } from "./video-date";
import { videoPlaybackHref } from "~/lib/video-navigation";

export function VideoCard({
  video,
  compact = false,
  tabIndex,
  returnHome = false,
}: {
  video: Video;
  compact?: boolean;
  tabIndex?: number;
  returnHome?: boolean;
}) {
  const Heading = compact ? "h2" : "h3";
  const href = videoPlaybackHref(video, returnHome);
  return (
    <article className={`video-card ${compact ? "compact-card" : ""}`}>
      <Link
        className="thumbnail"
        href={href}
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
            <Link href={href} tabIndex={tabIndex}>
              {video.title}
            </Link>
          </Heading>
          <p>
            <VideoDate video={video} />
          </p>
        </div>
      </div>
    </article>
  );
}
