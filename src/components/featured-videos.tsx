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
  const trackRef = useRef<HTMLDivElement>(null);
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
    const track = trackRef.current;
    if (!strip || !group || !track || !canScroll || !autoScroll) return;

    const pixelsPerMs = 0.036;
    let cycle = 0;
    let motions: Animation[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let hovered = strip.matches(":hover");
    let dragging = false;
    let visible = true;
    let resumeAfter = 0;

    // Transfer the compositor's exact position to native scrolling when interacting.
    const suspend = () => {
      const motion = motions[0];
      if (!motion) return;
      const time = Number(motion.currentTime ?? 0);
      const position = (strip.scrollLeft + time * pixelsPerMs) % cycle;
      motions.forEach((animation) => animation.cancel());
      motions = [];
      strip.scrollLeft = position;
    };
    const reconcile = () => {
      if (disposed) return;
      clearTimeout(timer);
      const remaining = resumeAfter - performance.now();
      if (
        hovered ||
        dragging ||
        !visible ||
        document.hidden ||
        strip.matches(":focus-within") ||
        remaining > 0
      ) {
        suspend();
        if (remaining > 0) timer = setTimeout(reconcile, remaining);
        return;
      }
      if (motions.length || cycle <= 0) return;
      const position = strip.scrollLeft % cycle;
      const halfDuration = cycle / pixelsPerMs;
      // Each group wraps only while fully outside the viewport. The other group
      // keeps moving across the screen without a visible transform reset.
      motions = Array.from(track.children).map((element, index) => {
        const animation = element.animate(
          [
            { transform: `translate3d(${index === 0 ? cycle : 0}px, 0, 0)` },
            {
              transform: `translate3d(-${index === 0 ? cycle : cycle * 2}px, 0, 0)`,
            },
          ],
          {
            duration: halfDuration * 2,
            delay: index === 0 ? -halfDuration : 0,
            iterations: Infinity,
            easing: "linear",
          },
        );
        animation.pause();
        animation.currentTime = position / pixelsPerMs;
        return animation;
      });
      strip.scrollLeft = 0;
      const now = document.timeline.currentTime;
      for (const animation of motions) {
        if (typeof now === "number")
          animation.startTime = now - position / pixelsPerMs;
        else animation.play();
      }
    };
    const pauseBriefly = () => {
      resumeAfter = performance.now() + 2500;
      reconcile();
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        hovered = true;
        reconcile();
      }
    };
    const leave = () => {
      hovered = false;
      reconcile();
    };
    const down = () => {
      dragging = true;
      reconcile();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      pauseBriefly();
    };
    const focusChanged = () => queueMicrotask(reconcile);
    const resize = new ResizeObserver(() => {
      suspend();
      cycle =
        group.getBoundingClientRect().width +
        parseFloat(getComputedStyle(track).columnGap);
      reconcile();
    });
    resize.observe(strip);
    resize.observe(group);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      reconcile();
    });
    visibility.observe(strip);
    strip.addEventListener("pointerenter", enter);
    strip.addEventListener("pointerleave", leave);
    strip.addEventListener("pointerdown", down);
    strip.addEventListener("wheel", pauseBriefly, { passive: true });
    strip.addEventListener("focusin", focusChanged);
    strip.addEventListener("focusout", focusChanged);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      disposed = true;
      clearTimeout(timer);
      suspend();
      resize.disconnect();
      visibility.disconnect();
      strip.removeEventListener("pointerenter", enter);
      strip.removeEventListener("pointerleave", leave);
      strip.removeEventListener("pointerdown", down);
      strip.removeEventListener("wheel", pauseBriefly);
      strip.removeEventListener("focusin", focusChanged);
      strip.removeEventListener("focusout", focusChanged);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [autoScroll, canScroll, videos]);

  if (!videos.length && !viewer.data?.isOfficial) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h2 id={headingId}>精选</h2>
      </div>
      {videos.length ? (
        <div className={styles.strip} ref={stripRef}>
          <div className={styles.track} ref={trackRef}>
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
        </div>
      ) : (
        <p className={styles.empty}>
          还没有精选视频。打开视频的“管理视频”即可添加。
        </p>
      )}
    </section>
  );
}
