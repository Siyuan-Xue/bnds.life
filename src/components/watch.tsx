"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Video } from "~/lib/videos";
import {
  watchColumnAspectRatio,
  watchRecommendationCount,
} from "~/lib/video-layout";
import { Player } from "./player";
import { Story } from "./story";
import { Discussion } from "./discussion";
import { VideoManagement } from "./video-management";
import { VideoCard } from "./video-card";
import { VideoDate } from "./video-date";

export function Watch({ video, related }: { video: Video; related: Video[] }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLElement>(null);
  const [relatedCount, setRelatedCount] = useState(related.length);
  const [geometry, setGeometry] = useState<{ source: string; ratio: number }>();
  const rememberRatio = useCallback((source: string, ratio: number) => {
    setGeometry((previous) =>
      previous?.source === source && previous.ratio === ratio
        ? previous
        : { source, ratio },
    );
  }, []);
  const ratio = geometry?.source === video.source ? geometry.ratio : 16 / 9;
  useLayoutEffect(() => {
    const main = mainRef.current;
    const list = relatedRef.current;
    const layout = list?.parentElement;
    if (!main || !list || !layout) return;

    const updateCount = () => {
      if (!window.matchMedia("(min-width: 1000px)").matches) {
        setRelatedCount(related.length);
        return;
      }
      const card = list.firstElementChild;
      if (!card) {
        setRelatedCount(related.length);
        return;
      }
      const top = list.getBoundingClientRect().top + window.scrollY;
      const padding = parseFloat(getComputedStyle(layout).paddingBottom);
      const height = Math.max(
        main.getBoundingClientRect().height,
        window.innerHeight - top - padding,
      );
      setRelatedCount(
        watchRecommendationCount(
          height,
          card.getBoundingClientRect().height,
          parseFloat(getComputedStyle(list).rowGap),
          related.length,
        ),
      );
    };

    updateCount();
    const observer = new ResizeObserver(updateCount);
    observer.observe(main);
    observer.observe(list);
    window.addEventListener("resize", updateCount);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCount);
    };
  }, [related]);
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
      <div className="watch-main" ref={mainRef}>
        <div className="watch-stage">
          <Player video={video} onAspectRatio={rememberRatio} />
        </div>
        <section className="watch-details">
          <div className="watch-heading">
            <h1>{video.title}</h1>
            <p className="watch-date">
              <VideoDate video={video} />
            </p>
          </div>
          <VideoManagement key={`manage-${video.id}`} video={video} />
          <Story video={video} />
          <Discussion
            key={`comments-${video.id}`}
            videoId={video.id}
            demo={video.isDemo === true || video.id.startsWith("memory-")}
          />
        </section>
      </div>
      <aside className="related-videos" aria-label="更多视频" ref={relatedRef}>
        {related.slice(0, relatedCount).map((item) => (
          <VideoCard key={item.id} video={item} compact />
        ))}
      </aside>
    </div>
  );
}
