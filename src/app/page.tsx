import Link from "next/link";
import { redirect } from "next/navigation";
import { FeaturedVideos } from "~/components/featured-videos";
import { VideoTimeline } from "~/components/video-timeline";
import { RestoreHomeScroll } from "~/components/restore-home-scroll";
import { listHomeVideos } from "~/server/videos";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.slice(0, 200).trim() : "";
  if (query) redirect(`/search?${new URLSearchParams({ q: query })}`);
  const videos = await listHomeVideos();
  return (
    <div className="home-page">
      <RestoreHomeScroll />
      <h1 className="sr-only">首页</h1>
      <FeaturedVideos videos={videos.filter((video) => video.isFeatured)} />
      {videos.length ? (
        <VideoTimeline videos={videos} />
      ) : (
        <div className="empty-state">
          <h2>暂时没有长视频</h2>
          <Link href="/recommend">去看看短拍</Link>
        </div>
      )}
    </div>
  );
}
