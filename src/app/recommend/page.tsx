import { Recommend } from "~/components/recommend";
import { recommendVideos } from "~/lib/videos";
export const metadata = { title: "推荐 · BNDS.life" };
export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <Recommend
      videos={recommendVideos(
        typeof params.v === "string" ? params.v : undefined,
      )}
    />
  );
}
