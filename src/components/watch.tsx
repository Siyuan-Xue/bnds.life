"use client";
import { useCallback, useState, type CSSProperties } from "react";
import type { Video } from "~/lib/videos";
import { watchColumnAspectRatio } from "~/lib/video-layout";
import { Player } from "./player";
import { Comments } from "./comments";
import { VideoCard } from "./video-card";

export function Watch({ video, related }: { video: Video; related: Video[] }) {
  const [theater, setTheater] = useState(false);
  const [description, setDescription] = useState(false);
  const [geometry, setGeometry] = useState<{ source: string; ratio: number }>();
  const rememberRatio = useCallback((source: string, ratio: number) => {
    setGeometry((previous) =>
      previous?.source === source && previous.ratio === ratio
        ? previous
        : { source, ratio },
    );
  }, []);
  const ratio = geometry?.source === video.source ? geometry.ratio : 16 / 9;
  return (
    <div
      className={`watch-layout ${theater ? "theater-mode" : ""}`}
      style={
        {
          "--watch-ratio": ratio,
          "--watch-column-ratio": watchColumnAspectRatio(ratio),
        } as CSSProperties
      }
    >
      <div className="watch-stage">
        <Player
          video={video}
          theater={theater}
          onAspectRatio={rememberRatio}
          onTheater={() => {
            setTheater((value) => !value);
            requestAnimationFrame(() =>
              window.scrollTo({ top: 0, behavior: "instant" }),
            );
          }}
        />
      </div>
      <section className="watch-details">
        <h1>{video.title}</h1>
        <div className="watch-byline">
          <span className="avatar">十</span>
          <div>
            <strong>{video.author}</strong>
            <p>占位视频</p>
          </div>
        </div>
        <div className="video-description">
          <strong>示例内容</strong>
          <p>
            {description
              ? video.description
              : "这是一段用于预览浏览和播放效果的占位视频。"}
            <button
              onClick={() => setDescription(!description)}
              aria-expanded={description}
            >
              {description ? "收起" : "展开"}
            </button>
          </p>
        </div>
        <Comments />
      </section>
      <aside className="related-videos" aria-label="更多视频">
        {related.map((item) => (
          <VideoCard key={item.id} video={item} compact />
        ))}
      </aside>
    </div>
  );
}
