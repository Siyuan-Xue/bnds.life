import { join } from "node:path";
import { hashFile, verifyAsset, verifyOriginalMetadata } from "./files.mjs";
import { withMediaLock } from "./store.mjs";
import { removeOriginalFiles } from "./deletion.mjs";

// Receipts prove usable stored outputs, not an archived camera file.
export async function sourceReceipts(sql, root, { execute = false } = {}) {
  return withMediaLock(sql, async (conn) => {
    const rows =
      await conn`SELECT id,status,source_sha256 FROM videos ORDER BY id`;
    const assets = await conn`SELECT * FROM video_assets`;
    const verified = [],
      rejected = [];
    for (const row of rows) {
      try {
        const media = assets.filter((a) => a.video_id === row.id);
        if (
          !["original", "playback", "poster"].every((kind) =>
            media.some((a) => a.kind === kind),
          )
        )
          throw new Error("媒体资源尚未齐全");
        const original = media.find((a) => a.kind === "original");
        verifyOriginalMetadata(original, row.source_sha256);
        for (const asset of media) {
          await verifyAsset(root, asset);
          if (
            asset.kind !== "original" &&
            (await hashFile(join(root, asset.object_key))) !== asset.sha256
          )
            throw new Error(`播放资源哈希不一致：${asset.kind}`);
        }
        verified.push({
          id: row.id,
          status: row.status,
          sha256: row.source_sha256,
          size: Number(original.size_bytes),
          originalFilename: original.original_filename,
        });
      } catch (error) {
        rejected.push({ id: row.id, error: error.message });
      }
    }
    // Validate the entire selection before removing any legacy originals.
    if (execute && rejected.length)
      throw new Error(
        `资源校验失败，未删除任何原片：${JSON.stringify(rejected)}`,
      );
    if (execute)
      for (const row of verified) await removeOriginalFiles(root, row.id);
    return {
      verifiedAt: new Date().toISOString(),
      policy: "metadata-only-originals",
      executed: execute,
      verified,
      rejected,
    };
  });
}
