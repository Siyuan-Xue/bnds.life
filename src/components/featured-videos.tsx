"use client";

import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import { VideoCard } from "./video-card";
import styles from "./featured-videos.module.css";

export function FeaturedVideos({ videos }: { videos: Video[] }) {
  const viewer = api.discussion.viewer.useQuery();
  if (!videos.length && !viewer.data?.isOfficial) return null;
  return (
    <section className={styles.section} aria-labelledby="featured-heading">
      <h2 id="featured-heading">精选</h2>
      {videos.length ? (
        <div className={styles.strip}>
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          还没有精选视频。打开视频的“管理视频”即可添加。
        </p>
      )}
    </section>
  );
}
