import { notFound, redirect } from "next/navigation";
import { Watch } from "~/components/watch";
import { findVideo, listVideos } from "~/server/videos";
import { isShortVideo } from "~/lib/video-sections";
import { relatedLongVideos, videoPlaybackHref } from "~/lib/video-navigation";
export const dynamic = "force-dynamic";
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const video = await findVideo((await params).id);
  if (!video) notFound();
  if (isShortVideo(video)) redirect(videoPlaybackHref(video));
  const related = relatedLongVideos(video, await listVideos());
  const query = await searchParams;
  return (
    <Watch
      key={video.id}
      video={video}
      related={related}
      returnHome={query.from === "home"}
    />
  );
}
