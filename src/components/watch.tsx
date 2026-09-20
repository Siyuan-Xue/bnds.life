"use client";
import { useCallback, useState, type CSSProperties } from "react";
import type { Video } from "~/lib/videos";
import { watchColumnAspectRatio } from "~/lib/video-layout";
import { Player } from "./player";
import { Story } from "./story";
import { VideoCard } from "./video-card";

export function Watch({ video, related }: { video: Video; related: Video[] }) {
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
      className="watch-layout"
      style={
        {
          "--watch-ratio": ratio,
          "--watch-column-ratio": watchColumnAspectRatio(ratio),
        } as CSSProperties
      }
    >
      <div className="watch-stage">
        <Player video={video} onAspectRatio={rememberRatio} />
      </div>
      <section className="watch-details">
        <h1>{video.title}</h1>
        <Story video={video} />
      </section>
      <aside className="related-videos" aria-label="更多视频">
        {related.map((item) => (
          <VideoCard key={item.id} video={item} compact />
        ))}
      </aside>
    </div>
  );
}
