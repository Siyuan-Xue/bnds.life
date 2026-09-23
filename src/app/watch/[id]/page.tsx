import { notFound } from "next/navigation";
import { Watch } from "~/components/watch";
import { findVideo, listVideos } from "~/server/videos";
import { isShortVideo } from "~/lib/video-sections";
export const dynamic = "force-dynamic";
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; next?: string }>;
}) {
  const video = await findVideo((await params).id);
  if (!video) notFound();
  const related = (await listVideos()).filter((item) => item.id !== video.id);
  const query = await searchParams;
  const nextShortVideoId = isShortVideo(video)
    ? (related.find((item) => item.id === query.next && isShortVideo(item))
        ?.id ?? related.find(isShortVideo)?.id)
    : undefined;
  return (
    <Watch
      key={video.id}
      video={video}
      related={related}
      returnHome={query.from === "home"}
      nextShortVideoId={nextShortVideoId}
    />
  );
}
