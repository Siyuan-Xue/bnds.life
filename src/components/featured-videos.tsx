"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "./ui/carousel";
import { VideoCard } from "./video-card";
import styles from "./featured-videos.module.css";

export function FeaturedVideos({ videos }: { videos: Video[] }) {
  const viewer = api.discussion.viewer.useQuery();
  const headingId = useId();
  const [carousel, setCarousel] = useState<CarouselApi>();
  const [canScroll, setCanScroll] = useState(false);
  const autoplay = useMemo(
    () =>
      Autoplay({
        delay: 2800,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
        playOnInit: false,
      }),
    [],
  );
  const wheel = useMemo(() => WheelGesturesPlugin(), []);
  const plugins = useMemo(() => [autoplay, wheel], [autoplay, wheel]);

  useEffect(() => {
    if (!carousel) return;
    const root = carousel.rootNode();
    const update = () => {
      const slide = carousel.slideNodes()[0];
      if (!slide) return setCanScroll(false);
      const gap =
        parseFloat(getComputedStyle(carousel.containerNode()).columnGap) || 0;
      const width = slide.getBoundingClientRect().width;
      setCanScroll(videos.length * (width + gap) - gap > root.clientWidth + 1);
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    const firstSlide = carousel.slideNodes()[0];
    if (firstSlide) observer.observe(firstSlide);
    carousel.on("reInit", update);
    update();
    return () => {
      observer.disconnect();
      carousel.off("reInit", update);
    };
  }, [carousel, videos.length]);

  useEffect(() => {
    if (!carousel) return;
    const updateScale = () => {
      const viewport = carousel.rootNode().getBoundingClientRect();
      const center = viewport.left + viewport.width / 2;
      const firstSlide = carousel.slideNodes()[0];
      if (!firstSlide) return;
      const width = firstSlide.getBoundingClientRect().width;
      const gap =
        parseFloat(getComputedStyle(carousel.containerNode()).columnGap) || 0;
      const pitch = Math.max(1, width + gap);
      for (const slide of carousel.slideNodes()) {
        const card = slide.firstElementChild as HTMLElement | null;
        if (!card) continue;
        const bounds = slide.getBoundingClientRect();
        const distance = Math.abs(bounds.left + bounds.width / 2 - center);
        const scale = canScroll
          ? Math.max(0.66, 1.08 - 0.23 * (distance / pitch))
          : 1;
        card.style.setProperty("--classic-scale", scale.toFixed(3));
      }
    };
    carousel.on("scroll", updateScale);
    carousel.on("reInit", updateScale);
    updateScale();
    return () => {
      carousel.off("scroll", updateScale);
      carousel.off("reInit", updateScale);
    };
  }, [canScroll, carousel]);

  useEffect(() => {
    if (!carousel) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (canScroll && visible && !preference.matches && !document.hidden)
        autoplay.play();
      else autoplay.stop();
    };
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    visibility.observe(carousel.rootNode());
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    carousel.on("reInit", sync);
    return () => {
      autoplay.stop();
      visibility.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      carousel.off("reInit", sync);
    };
  }, [autoplay, canScroll, carousel]);

  if (!videos.length && !viewer.data?.isOfficial) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h2 id={headingId} lang="en">
          For <span>You</span>
        </h2>
      </div>
      {videos.length ? (
        <Carousel
          className={styles.strip}
          opts={{
            align: "center",
            loop: canScroll,
            dragFree: false,
            duration: 32,
          }}
          plugins={plugins}
          setApi={setCarousel}
          aria-label="For You 视频"
          onDragStart={(event) => event.preventDefault()}
        >
          <CarouselContent
            className={styles.track}
            viewportClassName={styles.viewport}
          >
            {Array.from({ length: canScroll ? 3 : 1 }, (_, repetition) =>
              videos.map((video) => (
                <CarouselItem
                  className={styles.slide}
                  key={`${repetition}-${video.id}`}
                  aria-hidden={repetition ? true : undefined}
                >
                  <div className={styles.card}>
                    <VideoCard
                      video={video}
                      returnHome
                      tabIndex={repetition ? -1 : undefined}
                    />
                  </div>
                </CarouselItem>
              )),
            )}
          </CarouselContent>
        </Carousel>
      ) : (
        <p className={styles.empty}>
          还没有内容。打开视频的“管理视频”即可添加。
        </p>
      )}
    </section>
  );
}
