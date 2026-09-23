import { Recommend } from "~/components/recommend";
import { recommendVideos } from "~/server/videos";
export const dynamic = "force-dynamic";
export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const params = await searchParams;
  const startId = typeof params.v === "string" ? params.v : undefined;
  return (
    <Recommend
      key={startId ?? "start"}
      videos={await recommendVideos(startId)}
    />
  );
}
