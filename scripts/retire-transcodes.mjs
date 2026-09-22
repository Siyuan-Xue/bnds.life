#!/usr/bin/env node
import postgres from "postgres";
import { resolve, join } from "node:path";
import { stat, unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
import { withMediaLock } from "./media/store.mjs";

const { values } = parseArgs({
  options: {
    execute: { type: "boolean", default: false },
  },
});

const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });
const root = resolve(process.env.MEDIA_ROOT || "/srv/bnds-life/media");

try {
  const result = await withMediaLock(sql, async (conn) => {
    const rows = await conn`
      SELECT 
        v.id as video_id,
        p.id as playback_id, p.object_key as playback_key, p.size_bytes as playback_size,
        n.id as native_id, n.object_key as native_key, n.size_bytes as native_size,
        n.sha256 as native_sha256, n.width as native_width, n.height as native_height,
        n.duration_ms as native_duration_ms, n.processing_method as native_method,
        n.metadata as native_metadata
      FROM videos v
      JOIN video_assets p ON v.id = p.video_id AND p.kind = 'playback'
      JOIN video_assets n ON v.id = n.video_id AND n.kind = 'native'
      WHERE NOT EXISTS (SELECT 1 FROM deleted_video_sources WHERE source_sha256=v.source_sha256)
      ORDER BY v.id
    `;

    const verified = [];
    const errors = [];

    for (const r of rows) {
      const nativePath = join(root, r.native_key);
      const playbackPath = join(root, r.playback_key);

      try {
        const nStat = await stat(nativePath);
        if (nStat.size === 0 || nStat.size !== Number(r.native_size)) {
          throw new Error(
            `Native size mismatch: disk=${nStat.size}, db=${r.native_size}`,
          );
        }
        const pStat = await stat(playbackPath);
        verified.push({
          videoId: r.video_id,
          playbackId: r.playback_id,
          playbackPath,
          playbackSize: pStat.size,
          nativeId: r.native_id,
          nativeKey: r.native_key,
          nativeSize: r.native_size,
          nativeSha256: r.native_sha256,
          nativeWidth: r.native_width,
          nativeHeight: r.native_height,
          nativeDurationMs: r.native_duration_ms,
          nativeMethod: r.native_method,
          nativeMetadata: r.native_metadata,
        });
      } catch (err) {
        errors.push({ videoId: r.video_id, error: err.message });
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Preflight check failed on ${errors.length} items: ` +
          JSON.stringify(errors),
      );
    }

    let freedBytes = 0;
    const deletedFiles = [];

    if (values.execute) {
      await conn`BEGIN`;
      try {
        for (const item of verified) {
          await conn`
            UPDATE video_assets
            SET object_key = ${item.nativeKey},
                size_bytes = ${item.nativeSize},
                sha256 = ${item.nativeSha256},
                width = ${item.nativeWidth},
                height = ${item.nativeHeight},
                duration_ms = ${item.nativeDurationMs},
                processing_method = 'stream-copy',
                metadata = ${item.nativeMetadata}
            WHERE id = ${item.playbackId}
          `;
          await conn`DELETE FROM video_assets WHERE id = ${item.nativeId}`;
        }
        await conn`COMMIT`;
      } catch (err) {
        await conn`ROLLBACK`;
        throw err;
      }

      for (const item of verified) {
        try {
          await unlink(item.playbackPath);
          freedBytes += item.playbackSize;
          deletedFiles.push(item.playbackPath);
        } catch (err) {
          console.error(`Failed to unlink ${item.playbackPath}:`, err.message);
        }
      }
    } else {
      freedBytes = verified.reduce((acc, item) => acc + item.playbackSize, 0);
    }

    return {
      execute: values.execute,
      verifiedCount: verified.length,
      freedBytes,
      freedGb: (freedBytes / 1024 ** 3).toFixed(2),
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}
