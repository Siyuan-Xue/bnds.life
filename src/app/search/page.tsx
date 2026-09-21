import Link from "next/link";
import { redirect } from "next/navigation";
import { VideoTimeline } from "~/components/video-timeline";
import { listVideos } from "~/server/videos";

export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.slice(0, 200).trim() : "";
  if (!query) redirect("/");
  const videos = await listVideos(query);
  return (
    <div className="home-page">
      <h1 className="sr-only">搜索视频</h1>
      <div className="browse-toolbar">
        <span className="search-query" title={query}>
          搜索：{query}
        </span>
        <Link href="/">返回首页</Link>
      </div>
      {videos.length ? (
        <VideoTimeline videos={videos} />
      ) : (
        <div className="empty-state">
          <h2>没有找到相关视频</h2>
          <p>试试其他关键词。</p>
        </div>
      )}
    </div>
  );
}
