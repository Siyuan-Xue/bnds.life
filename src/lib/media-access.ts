const assetPath = /^\/media\/(playback|posters)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([A-Za-z0-9_.-]+)$/;

export function mediaAssetKey(uri: string) {
  const match = assetPath.exec(uri.split("?", 1)[0] ?? "");
  if (!match || match[3] === "." || match[3] === "..") return undefined;
  const kind = match[1]!;
  const id = match[2]!;
  const filename = match[3]!;
  return {
    videoId: id,
    key: `${kind}/${id}/${filename}`,
    kind: kind === "posters" ? "poster" : "playback",
  };
}
