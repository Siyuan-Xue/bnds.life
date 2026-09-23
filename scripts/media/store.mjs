import { randomUUID } from "node:crypto";
import {
  readFile,
  realpath,
  unlink,
  rm,
} from "node:fs/promises";
import { basename, resolve, sep, join } from "node:path";
import { normalizeRecordedDate } from "../../src/lib/recorded-date.ts";
import {
  hashFile,
  prepareMedia,
  verifyAsset,
  verifyOriginalMetadata,
  uuidPattern,
} from "./files.mjs";

async function transaction(conn, operation) {
  await conn.unsafe("BEGIN");
  try {
    const result = await operation(conn);
    await conn.unsafe("COMMIT");
    return result;
  } catch (error) {
    await conn.unsafe("ROLLBACK");
    throw error;
  }
}

export async function withMediaLock(sql, operation) {
  const connection = await sql.reserve();
  let locked = false;
  try {
    const [result] =
      await connection`SELECT pg_try_advisory_lock(1112425555) AS locked`;
    if (!result.locked) {
      const error = new Error("另一项媒体操作正在执行，请稍后重试");
      error.code = "MEDIA_LOCK_BUSY";
      throw error;
    }
    locked = true;
    return await operation(connection);
  } finally {
    try {
      if (locked) await connection`SELECT pg_advisory_unlock(1112425555)`;
    } finally {
      connection.release();
    }
  }
}
export async function migrate(sql) {
  const migration = (
    await Promise.all(
      [
        "001-media.sql",
        "002-native-playback.sql",
        "004-video-deletion.sql",
        "005-native-only.sql",
      ].map((name) =>
        readFile(
          new URL(`../../ops/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      ),
    )
  ).join("\n");
  await withMediaLock(sql, (conn) =>
    transaction(conn, (tx) => tx.unsafe(migration)),
  );
}
function validatedDetails(options, { partial = false } = {}) {
  const details = {};
  if (!partial || options.title !== undefined) {
    const title = options.title?.trim();
    if (!title || title.length > 200) throw new Error("标题需为 1–200 个字符");
    details.title = title;
  }
  if (options.story !== undefined) {
    if (typeof options.story !== "string" || options.story.length > 100000)
      throw new Error("故事长度不能超过 100000 字符");
    details.story = options.story || null;
  }
  if (options.recordedAt !== undefined) {
    const date =
      options.recordedAt === ""
        ? null
        : normalizeRecordedDate(options.recordedAt);
    if (date === undefined)
      throw new Error(
        "拍摄日期需为真实 YYYY、YYYY-MM 或 YYYY-MM-DD，可留空；不能使用上传日期代替",
      );
    details.recorded_date = date;
  }
  return details;
}
export async function importVideo(sql, options) {
  const file = resolve(options.file);
  const root = resolve(options.root);
  const details = validatedDetails({
    ...options,
    title: options.title ?? basename(file).replace(/\.[^.]+$/, ""),
  });
  const incomingRoot = await realpath(resolve(root, "incoming")).catch(
    () => null,
  );
  const consume =
    incomingRoot !== null &&
    (await realpath(file)).startsWith(incomingRoot + sep);
  if (options.consume && !consume)
    throw new Error("--consume 仅允许清理 incoming 目录内的文件");
  return withMediaLock(sql, async (conn) => {
    const sourceSha256 = await hashFile(file);
    const [existing] =
      await conn`SELECT id,status FROM videos WHERE source_sha256=${sourceSha256}`;
    const [deleted] =
      await conn`SELECT source_sha256 FROM deleted_video_sources WHERE source_sha256=${sourceSha256}`;
    if (deleted) {
      // A surviving row protects all incoming copies during retention, including
      // historical tombstones or partially failed cleanup. Only the scheduled
      // cleanup job may resume removing those files.
      if (!existing) {
        const { removeDeletedIncoming } = await import("./deletion.mjs");
        await removeDeletedIncoming(root, [sourceSha256]).catch(() => {});
      }
      const error = new Error("原片已进入永久清理流程，禁止重新导入");
      error.code = "VIDEO_SOURCE_DELETED";
      throw error;
    }
    if (existing) {
      if (consume) {
        const assets =
          await conn`SELECT * FROM video_assets WHERE video_id=${existing.id}`;
        if (
          !["original", "playback", "poster"].every((kind) =>
            assets.some((a) => a.kind === kind),
          )
        )
          throw new Error("已有视频资源不完整，保留 incoming 文件");
        verifyOriginalMetadata(
          assets.find((a) => a.kind === "original"),
          sourceSha256,
        );
        for (const asset of assets) {
          await verifyAsset(root, asset);
          if (
            asset.kind !== "original" &&
            (await hashFile(resolve(root, asset.object_key))) !== asset.sha256
          )
            throw new Error("已有播放资源哈希不一致，保留 incoming 文件");
        }
        if ((await hashFile(file)) !== sourceSha256)
          throw new Error("incoming 文件已变化，未清理");
        await unlink(file);
      }
      return {
        ...existing,
        duplicate: true,
        warnings: [
          "相同原片已存在，标题/故事/发布状态保持不变；如需修改请使用 edit/publish",
        ],
      };
    }
    const id = randomUUID();
    const prepared = await prepareMedia({ ...options, root, file, id });
    try {
      if (sourceSha256 !== prepared.sourceSha256)
        throw new Error("文件在导入中变化，拒绝入库");
      await transaction(conn, async (tx) => {
        await tx`INSERT INTO videos ${tx({ id, title: details.title, story: details.story ?? null, recorded_date: details.recorded_date ?? null, source_sha256: sourceSha256, status: options.publish ? "published" : "draft", published_at: options.publish ? new Date() : null })}`;
        for (const a of prepared.assets)
          await tx`INSERT INTO video_assets ${tx({ id: randomUUID(), video_id: id, kind: a.kind, object_key: a.objectKey, original_filename: a.originalFilename, mime_type: a.mimeType, size_bytes: a.sizeBytes, sha256: a.sha256, width: a.width, height: a.height, duration_ms: a.durationMs, processing_method: a.processingMethod, metadata: a.metadata === null ? null : tx.json(a.metadata) })}`;
      });
    } catch (error) {
      // An interrupted COMMIT can be ambiguous: preserve referenced outputs.
      const persisted = await conn`SELECT id FROM videos WHERE id=${id}`.catch(
        () => null,
      );
      if (persisted && !persisted.length)
        for (const folder of ["playback", "posters"])
          await rm(join(root, folder, id), { recursive: true, force: true });
      throw error;
    }
    if (consume) {
      if ((await hashFile(file)) !== sourceSha256)
        prepared.warnings.push(
          "incoming 文件已变化，未清理；服务器仅保留播放文件与原片元数据",
        );
      else await unlink(file);
    }
    return {
      id,
      status: options.publish ? "published" : "draft",
      duplicate: false,
      warnings: prepared.warnings,
      processing: prepared.assets.find((a) => a.kind === "playback")
        .processingMethod,
    };
  });
}
export async function setStatus(sql, root, id, status) {
  if (!uuidPattern.test(id) || !["published", "hidden"].includes(status))
    throw new Error("无效的视频 ID 或状态");
  return withMediaLock(sql, (connection) =>
    transaction(connection, async (conn) => {
      await conn`SELECT id FROM videos WHERE id=${id} FOR UPDATE`;
      const [row] =
        await conn`SELECT id,source_sha256 FROM videos WHERE id=${id} AND NOT EXISTS (SELECT 1 FROM deleted_video_sources WHERE source_sha256=videos.source_sha256)`;
      if (!row) throw new Error("未找到视频");
      if (status === "published") {
        const assets =
          await conn`SELECT * FROM video_assets WHERE video_id=${id}`;
        if (
          !["original", "playback", "poster"].every((kind) =>
            assets.some((a) => a.kind === kind),
          )
        )
          throw new Error("媒体资源尚未齐全，不能发布");
        verifyOriginalMetadata(
          assets.find((a) => a.kind === "original"),
          row.source_sha256,
        );
        for (const asset of assets) await verifyAsset(root, asset);
      }
      const changed =
        await conn`UPDATE videos SET status=${status},published_at=CASE WHEN ${status}='published' THEN COALESCE(published_at,now()) ELSE published_at END,updated_at=now() WHERE id=${id} AND NOT EXISTS (SELECT 1 FROM deleted_video_sources WHERE source_sha256=videos.source_sha256) RETURNING id`;
      if (!changed.length) throw new Error("视频不存在或已申请永久删除");
      return { id, status };
    }),
  );
}

export async function editVideo(sql, id, options) {
  if (!uuidPattern.test(id)) throw new Error("无效的视频 ID");
  const details = validatedDetails(options, { partial: true });
  if (!Object.keys(details).length)
    throw new Error("请提供需要修改的标题、日期或故事");
  return withMediaLock(sql, async (conn) => {
    const result =
      await conn`UPDATE videos SET ${conn({ ...details, updated_at: new Date() })} WHERE id=${id} RETURNING id,title,recorded_date,status`;
    if (!result.length) throw new Error("未找到视频");
    return result[0];
  });
}
