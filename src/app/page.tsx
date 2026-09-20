import Link from "next/link";
import { VideoCard } from "~/components/video-card";
import { listVideos } from "~/server/videos";
import { groupVideosByMonth } from "~/lib/video-timeline";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const videos = await listVideos(query);
  const months = groupVideosByMonth(videos);
  return (
    <div className="home-page">
      <h1 className="sr-only">首页</h1>
      {query && (
        <div className="browse-toolbar">
          <span className="search-query" title={query}>
            搜索：{query}
          </span>
          <Link href="/">查看全部</Link>
        </div>
      )}
      {videos.length ? (
        <div className="video-timeline">
          {months.map(({ month, videos }) => {
            const headingId = `month-${month ?? "unknown"}`;
            return (
              <section
                className="timeline-month"
                key={month ?? "unknown"}
                aria-labelledby={headingId}
              >
                <div className="month-heading">
                  <h2 id={headingId}>
                    {month ? (
                      <time dateTime={month}>
                        {month.slice(0, 4)}年{Number(month.slice(5))}月
                      </time>
                    ) : (
                      "时间待补充"
                    )}
                  </h2>
                  <span>{videos.length} 段视频</span>
                </div>
                <div className="video-grid">
                  {videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h1>{query ? "没有找到相关视频" : "暂时没有视频"}</h1>
          {query && (
            <>
              <p>试试其他关键词。</p>
              <Link href="/">返回首页</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
