import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Watch } from "~/components/watch";
import { findVideo, listVideos } from "~/server/videos";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const video = await findVideo((await params).id);
  return {
    title: video ? `${video.title} · BNDS.life` : "未找到视频 · BNDS.life",
  };
}
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
