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
import { recommendationAspectRatio } from "~/lib/video-layout";

export function Recommend({ videos }: { videos: Video[] }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const rememberRatio = useCallback((source: string, ratio: number) => {
    setRatios((previous) =>
      previous[source] === ratio ? previous : { ...previous, [source]: ratio },
    );
  }, []);
  const storyButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const storyDialog = useRef<HTMLDialogElement>(null);
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
  }, [navigate]);
  useEffect(() => {
    const dialog = storyDialog.current;
    if (!storyOpen || !dialog) return;
    if (!dialog.open) dialog.showModal();
    panel.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="关闭故事"]')
      ?.focus();
    return () => dialog.close();
  }, [storyOpen]);
  const current = videos[active];
  if (!current) return <p className="empty-state">暂时没有视频</p>;
  return (
    <div className="recommend-layout">
      <div
        className="feed-scroll"
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
          const ratio = recommendationAspectRatio(ratios[video.source]);
          return (
            <article
              key={video.id}
              className="feed-item"
              aria-label={`${index + 1} / ${videos.length}：${video.title}`}
              aria-hidden={index !== active}
              inert={index !== active}
            >
              <div
                className="feed-video-wrap"
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
      <div className="feed-navigation">
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
        <dialog
          className="story-dialog"
          ref={storyDialog}
          aria-label="视频故事"
          onCancel={(event) => {
            event.preventDefault();
            closeStory();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeStory();
          }}
        >
          <div className="story-dialog-content" ref={panel}>
            <Story video={current} onClose={closeStory} />
          </div>
        </dialog>
      )}
      <span className="sr-only" aria-live="polite">
        正在观看：{current.title}
      </span>
    </div>
  );
}
