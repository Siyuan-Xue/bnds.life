import Link from "next/link";
import { VideoCard } from "~/components/video-card";
import { listVideos } from "~/lib/videos";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const videos = listVideos(query);
  return (
    <div className="home-page">
      <div className="browse-toolbar">
        {query ? (
          <>
            <span className="search-query" title={query}>
              搜索：{query}
            </span>
            <Link href="/">查看全部</Link>
          </>
        ) : (
          <span className="filter-chip">全部</span>
        )}
      </div>
      {videos.length ? (
        <div className="video-grid">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h1>没有找到相关视频</h1>
          <p>试试其他关键词。</p>
          <Link href="/">返回首页</Link>
        </div>
      )}
    </div>
  );
}
