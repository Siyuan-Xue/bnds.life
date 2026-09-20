import { notFound } from "next/navigation";
import { Watch } from "~/components/watch";
import { findVideo, listVideos } from "~/server/videos";
export const dynamic = "force-dynamic";
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const video = await findVideo((await params).id);
  if (!video) notFound();
  return (
    <Watch
      key={video.id}
      video={video}
      related={(await listVideos()).filter((item) => item.id !== video.id)}
    />
  );
}
