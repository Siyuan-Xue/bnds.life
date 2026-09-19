import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Watch } from "~/components/watch";
import { findVideo, listVideos } from "~/lib/videos";
export function generateStaticParams() {
  return listVideos().map((video) => ({ id: video.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const video = findVideo((await params).id);
  return {
    title: video ? `${video.title} · bnds life` : "未找到视频 · bnds life",
  };
}
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const video = findVideo((await params).id);
  if (!video) notFound();
  return (
    <Watch
      key={video.id}
      video={video}
      related={listVideos().filter((item) => item.id !== video.id)}
    />
  );
}
