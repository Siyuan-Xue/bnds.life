"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import { VideoCard } from "./video-card";
import styles from "./featured-videos.module.css";

export function FeaturedVideos({ videos }: { videos: Video[] }) {
  const viewer = api.discussion.viewer.useQuery();
  const headingId = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAutoScroll(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    const group = groupRef.current;
    if (!strip || !group) return;
    const update = () => {
      setCanScroll(group.getBoundingClientRect().width > strip.clientWidth + 1);
    };
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    observer.observe(group);
    update();
    return () => observer.disconnect();
  }, [videos]);

  useEffect(() => {
    const strip = stripRef.current;
    const group = groupRef.current;
    if (!strip || !group || !canScroll || !autoScroll) return;

    let frame = 0;
    let previousTime = 0;
    let position = strip.scrollLeft;
    let lastWritten = position;
    let hovered = strip.matches(":hover");
    let dragging = false;
    let visible = true;
    let resumeAfter = 0;
    const pauseBriefly = () => {
      resumeAfter = performance.now() + 2500;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") hovered = true;
    };
    const leave = () => {
      hovered = false;
    };
    const down = () => {
      dragging = true;
    };
    const up = () => {
      dragging = false;
      pauseBriefly();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(strip);
    strip.addEventListener("pointerenter", enter);
    strip.addEventListener("pointerleave", leave);
    strip.addEventListener("pointerdown", down);
    strip.addEventListener("wheel", pauseBriefly, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const tick = (now: number) => {
      const elapsed = previousTime ? Math.min(now - previousTime, 50) : 0;
      previousTime = now;
      const paused =
        hovered ||
        dragging ||
        !visible ||
        document.hidden ||
        strip.matches(":focus-within") ||
        now < resumeAfter;
      if (paused) {
        position = strip.scrollLeft;
      } else {
        // Keep subpixel progress even when the browser rounds scrollLeft.
        if (Math.abs(strip.scrollLeft - lastWritten) > 1)
          position = strip.scrollLeft;
        const cycle =
          group.getBoundingClientRect().width +
          parseFloat(getComputedStyle(strip).columnGap);
        if (cycle > 0) {
          position = (position + elapsed * 0.036) % cycle;
          strip.scrollLeft = position;
        }
      }
      lastWritten = strip.scrollLeft;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      strip.removeEventListener("pointerenter", enter);
      strip.removeEventListener("pointerleave", leave);
      strip.removeEventListener("pointerdown", down);
      strip.removeEventListener("wheel", pauseBriefly);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [autoScroll, canScroll, videos]);

  if (!videos.length && !viewer.data?.isOfficial) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h2 id={headingId}>精选</h2>
        {canScroll && (
          <button
            type="button"
            className={styles.motionButton}
            onClick={() => setAutoScroll((current) => !current)}
            aria-label={autoScroll ? "暂停精选自动滚动" : "继续精选自动滚动"}
          >
            {autoScroll ? "暂停滚动" : "继续滚动"}
          </button>
        )}
      </div>
      {videos.length ? (
        <div className={styles.strip} ref={stripRef}>
          <div className={styles.group} ref={groupRef}>
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
          {canScroll && (
            <div className={styles.group} aria-hidden="true">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} tabIndex={-1} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className={styles.empty}>
          还没有精选视频。打开视频的“管理视频”即可添加。
        </p>
      )}
    </section>
  );
}
