"use client";
import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Video } from "~/lib/videos";
import { StoryPanel } from "./story";
import { VideoManagement } from "./video-management";
import { Icon } from "./icon";
import { Player } from "./player";
import { isPlaybackShortcut } from "~/lib/shortcuts";
import {
  MOBILE_LAYOUT_QUERY,
  recommendationAspectRatio,
  recommendationResizeScrollTop,
} from "~/lib/video-layout";

export function Recommend({ videos }: { videos: Video[] }) {
  const layout = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const activeFrame = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeIndex = useRef(0);
  const itemHeight = useRef<number | undefined>(undefined);
  const [storyOpen, setStoryOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidePanelOpen = storyOpen && !mobile;
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const rememberRatio = useCallback((source: string, ratio: number) => {
    setRatios((previous) =>
      previous[source] === ratio ? previous : { ...previous, [source]: ratio },
    );
  }, []);
  const storyButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const storyDialog = useRef<HTMLDialogElement>(null);
  const realignFeedHeight = useCallback(() => {
    const root = scroll.current;
    if (!root) return false;
    const height = root.firstElementChild?.getBoundingClientRect().height ?? 0;
    const top = recommendationResizeScrollTop(
      activeIndex.current,
      itemHeight.current,
      height,
    );
    if (Number.isFinite(height) && height > 0) itemHeight.current = height;
    if (top === undefined) return false;
    root.scrollTo({ top, behavior: "instant" });
    return true;
  }, []);
  useLayoutEffect(() => {
    const item = scroll.current?.firstElementChild;
    if (!item) return;
    realignFeedHeight();
    const observer = new ResizeObserver(realignFeedHeight);
    observer.observe(item, { box: "border-box" });
    return () => observer.disconnect();
  }, [realignFeedHeight, videos.length]);
  const [storyFrame, setStoryFrame] = useState<{
    top: number;
    height: number;
  }>();
  useLayoutEffect(() => {
    const frame = activeFrame.current;
    const root = layout.current;
    const scroller = scroll.current;
    if (!sidePanelOpen || !frame || !root || !scroller) return;
    const sync = () => {
      const bounds = frame.getBoundingClientRect();
      const top = bounds.top - root.getBoundingClientRect().top;
      const height = bounds.height;
      setStoryFrame((previous) =>
        previous?.top === top && previous.height === height
          ? previous
          : { top, height },
      );
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(frame);
    observer.observe(root);
    scroller.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", sync);
    };
  }, [active, sidePanelOpen]);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const sync = () => setMobile(query.matches);
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
  }, [closeStory, storyOpen, navigate]);
  useEffect(() => {
    const dialog = storyDialog.current;
    if (!storyOpen) return;
    if (mobile && dialog) {
      if (!dialog.open) dialog.showModal();
      panel.current?.focus({ preventScroll: true });
    } else {
      panel.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="关闭故事"]')
        ?.focus();
    }
    return () => dialog?.close();
  }, [storyOpen, mobile]);
  const current = videos[active];
  if (!current) return <p className="empty-state">暂时没有视频</p>;
  return (
    <div
      className={`recommend-layout ${sidePanelOpen ? "has-story" : ""}`}
      ref={layout}
    >
      <div
        className="feed-scroll"
        ref={scroll}
        onScroll={() => {
          const root = scroll.current;
          // Resize scroll events can arrive before ResizeObserver. Correct the
          // old pixel offset before it can select a different active video.
          if (!root || realignFeedHeight()) return;
          const index = Math.max(
            0,
            Math.min(
              videos.length - 1,
              Math.round(root.scrollTop / (root.scrollHeight / videos.length)),
            ),
          );
          activeIndex.current = index;
          setActive(index);
        }}
        aria-label="短拍视频列表"
      >
        {videos.map((video, index) => {
          const ratio = recommendationAspectRatio(
            ratios[video.source],
            sidePanelOpen,
          );
          return (
            <article
              key={video.id}
              className={`feed-item ${ratio > 1 ? "feed-item-wide" : ""}`}
              aria-label={`${index + 1} / ${videos.length}：${video.title}`}
              aria-hidden={index !== active}
              inert={index !== active}
            >
              <div
                className="feed-video-wrap"
                ref={index === active ? activeFrame : undefined}
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
                  {video.isDemo && (
                    <p>
                      <span className="feed-sample">占位预览</span>
                    </p>
                  )}
                  <div className="feed-caption-title">
                    <Link
                      href={`/watch/${video.id}?next=${videos[(index + 1) % videos.length]?.id ?? ""}`}
                    >
                      {video.title}
                    </Link>
                    {index === active && (
                      <VideoManagement
                        key={video.id}
                        video={video}
                        nextShortVideoId={
                          videos.length > 1
                            ? videos[(index + 1) % videos.length]?.id
                            : undefined
                        }
                      />
                    )}
                  </div>
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
      {sidePanelOpen && (
        <div
          className="feed-story"
          ref={panel}
          aria-label="视频故事"
          style={
            storyFrame
              ? { top: storyFrame.top, height: storyFrame.height }
              : { visibility: "hidden" }
          }
        >
          <StoryPanel video={current} onClose={closeStory} />
        </div>
      )}
      {storyOpen && mobile && (
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
          <div
            className="story-dialog-content"
            ref={panel}
            tabIndex={-1}
            autoFocus
          >
            <StoryPanel video={current} onClose={closeStory} />
          </div>
        </dialog>
      )}
      <span className="sr-only" aria-live="polite">
        正在观看：{current.title}
      </span>
    </div>
  );
}
