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
import { Comments } from "./comments";
import { Icon } from "./icon";
import { Player } from "./player";
import { isPlaybackShortcut } from "~/lib/shortcuts";

export function Recommend({ videos }: { videos: Video[] }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [comments, setComments] = useState(false);
  const [compact, setCompact] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const commentsButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 791px)");
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
  const closeComments = useCallback(() => {
    setComments(false);
    requestAnimationFrame(() => commentsButton.current?.focus());
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isPlaybackShortcut(event) || document.querySelector("dialog[open]"))
        return;
      const target = event.target as HTMLElement;
      if (event.key === "Escape" && comments) {
        event.preventDefault();
        closeComments();
        return;
      }
      if (comments && compact && event.key === "Tab") {
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
          "input,textarea,select,button,[contenteditable],dialog[open],.comments",
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
  }, [closeComments, comments, compact, navigate]);
  useEffect(() => {
    if (comments)
      panel.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="关闭评论"]')
        ?.focus();
  }, [comments]);
  const current = videos[active];
  if (!current) return <p className="empty-state">暂时没有视频</p>;
  return (
    <div className={`recommend-layout ${comments ? "has-comments" : ""}`}>
      <div
        className="feed-scroll"
        inert={comments && compact}
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
        {videos.map((video, index) => (
          <article
            key={video.id}
            className="feed-item"
            aria-label={`${index + 1} / ${videos.length}：${video.title}`}
            aria-hidden={index !== active}
            inert={index !== active}
          >
            <div
              className={`feed-video-wrap ${(aspectRatios[video.id] ?? 9 / 16) > 9 / 16 ? "is-adaptive" : ""}`}
              style={
                {
                  "--feed-aspect-ratio": aspectRatios[video.id] ?? 9 / 16,
                } as CSSProperties
              }
            >
              {Math.abs(index - active) <= 1 ? (
                <Player
                  video={video}
                  active={index === active}
                  feed
                  onAspectRatio={(ratio) => {
                    // Keep the feed portrait-first; wider footage can grow up to a square.
                    const bounded = Math.min(1, Math.max(9 / 16, ratio));
                    setAspectRatios((previous) =>
                      previous[video.id] === bounded
                        ? previous
                        : { ...previous, [video.id]: bounded },
                    );
                  }}
                />
              ) : (
                <div className="feed-player inactive-poster">
                  <Image src={video.poster} fill unoptimized alt="" />
                </div>
              )}
              <div className="feed-caption">
                <p>
                  <span className="avatar small">十</span>
                  <strong>{video.author}</strong>
                  <span className="feed-sample">占位预览</span>
                </p>
                <Link href={`/watch/${video.id}`}>{video.title}</Link>
              </div>
              <div className="feed-actions">
                <button
                  ref={index === active ? commentsButton : undefined}
                  aria-label={`查看${video.title}的评论`}
                  onClick={() => setComments((value) => !value)}
                  aria-expanded={index === active && comments}
                >
                  <Icon name="comment" />
                </button>
                <span>评论</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="feed-navigation" inert={comments && compact}>
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
      {comments && (
        <>
          <button
            className="comments-backdrop"
            aria-label="关闭评论面板"
            onClick={closeComments}
          />
          <div
            className="feed-comments"
            ref={panel}
            role={compact ? "dialog" : undefined}
            aria-modal={compact || undefined}
            aria-label="视频评论"
          >
            <Comments key={current.id} onClose={closeComments} title="评论" />
          </div>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        正在观看：{current.title}
      </span>
    </div>
  );
}
