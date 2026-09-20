"use client";
import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Video } from "~/lib/videos";
import { Story } from "./story";
import { Icon } from "./icon";
import { Player } from "./player";
import { isPlaybackShortcut } from "~/lib/shortcuts";
import {
  recommendationAspectRatio,
  RECOMMEND_MOBILE_QUERY,
} from "~/lib/video-layout";

export function Recommend({ videos }: { videos: Video[] }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const rememberRatio = useCallback((source: string, ratio: number) => {
    setRatios((previous) =>
      previous[source] === ratio ? previous : { ...previous, [source]: ratio },
    );
  }, []);
  const storyButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia(RECOMMEND_MOBILE_QUERY);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const navigate = useCallback(
    (delta: number) => {
      const root = scroll.current;
      if (!root) return;
      const index = Math.max(0, Math.min(videos.length - 1, active + delta));
      root.scrollTo({
        top: index * (root.scrollHeight / videos.length),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    },
    [active, videos.length],
  );
  const closeStory = useCallback(() => {
    setStoryOpen(false);
    requestAnimationFrame(() => storyButton.current?.focus());
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isPlaybackShortcut(event) || document.querySelector("dialog[open]"))
        return;
      const target = event.target as HTMLElement;
      if (event.key === "Escape" && storyOpen) {
        event.preventDefault();
        closeStory();
        return;
      }
      if (storyOpen && compact && event.key === "Tab") {
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panel.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (
        target.closest(
          "input,textarea,select,button,[contenteditable],dialog[open],.story",
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        navigate(event.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeStory, storyOpen, compact, navigate]);
  useEffect(() => {
    if (storyOpen)
      panel.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="关闭故事"]')
        ?.focus();
  }, [storyOpen, compact]);
  const current = videos[active];
  if (!current) return <p className="empty-state">暂时没有视频</p>;
  return (
    <div className={`recommend-layout ${storyOpen ? "has-story" : ""}`}>
      <div
        className="feed-scroll"
        inert={storyOpen && compact}
        ref={scroll}
        onScroll={() => {
          const root = scroll.current;
          if (root)
            setActive(
              Math.max(
                0,
                Math.min(
                  videos.length - 1,
                  Math.round(
                    root.scrollTop / (root.scrollHeight / videos.length),
                  ),
                ),
              ),
            );
        }}
        aria-label="推荐视频列表"
      >
        {videos.map((video, index) => {
          const ratio = recommendationAspectRatio(
            ratios[video.source],
            storyOpen && !compact,
          );
          return (
            <article
              key={video.id}
              className="feed-item"
              aria-label={`${index + 1} / ${videos.length}：${video.title}`}
              aria-hidden={index !== active}
              inert={index !== active}
            >
              <div
                className={`feed-video-wrap ${ratio > 9 / 16 ? "is-adaptive" : ""}`}
                style={{ "--frame-ratio": ratio } as CSSProperties}
              >
                {Math.abs(index - active) <= 1 ? (
                  <Player
                    video={video}
                    active={index === active}
                    feed
                    onAspectRatio={rememberRatio}
                  />
                ) : (
                  <div className="feed-player inactive-poster">
                    <Image src={video.poster} fill unoptimized alt="" />
                  </div>
                )}
                <div className="feed-caption">
                  <p>
                    <span className="feed-sample">占位预览</span>
                  </p>
                  <Link href={`/watch/${video.id}`}>{video.title}</Link>
                </div>
                <div className="feed-actions">
                  <button
                    ref={index === active ? storyButton : undefined}
                    aria-label={`查看${video.title}的故事`}
                    onClick={() => setStoryOpen((value) => !value)}
                    aria-expanded={index === active && storyOpen}
                  >
                    <Icon name="story" />
                  </button>
                  <span>故事</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="feed-navigation" inert={storyOpen && compact}>
        <button
          className="icon-button"
          aria-label="上一个视频"
          onClick={() => navigate(-1)}
          disabled={active === 0}
        >
          <Icon name="up" />
        </button>
        <button
          className="icon-button"
          aria-label="下一个视频"
          onClick={() => navigate(1)}
          disabled={active === videos.length - 1}
        >
          <Icon name="down" />
        </button>
      </div>
      {storyOpen && (
        <>
          <button
            className="story-backdrop"
            aria-label="关闭故事面板"
            onClick={closeStory}
          />
          <div
            className="feed-story"
            ref={panel}
            role={compact ? "dialog" : undefined}
            aria-modal={compact || undefined}
            aria-label="视频故事"
          >
            <Story video={current} onClose={closeStory} />
          </div>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        正在观看：{current.title}
      </span>
    </div>
  );
}
