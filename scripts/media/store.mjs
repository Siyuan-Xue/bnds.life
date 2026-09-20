import { randomUUID } from "node:crypto";
import {
  readFile,
  realpath,
  unlink,
  mkdtemp,
  rename,
  chmod,
  stat,
  rm,
} from "node:fs/promises";
import { basename, resolve, sep, join } from "node:path";
import { normalizeRecordedDate } from "../../src/lib/recorded-date.ts";
import {
  hashFile,
  prepareMedia,
  verifyAsset,
  uuidPattern,
  createNativePlayback,
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
    if (!result.locked) throw new Error("另一项媒体操作正在执行，请稍后重试");
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
      ["001-media.sql", "002-native-playback.sql"].map((name) =>
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
  if (options.consume) {
    if (
      !(await realpath(file)).startsWith(
        (await realpath(resolve(root, "incoming"))) + sep,
      )
    )
      throw new Error("--consume 仅允许清理 incoming 目录内的文件");
  }
  return withMediaLock(sql, async (conn) => {
    const sourceSha256 = await hashFile(file);
    const [existing] =
      await conn`SELECT id,status FROM videos WHERE source_sha256=${sourceSha256}`;
    if (existing)
      return {
        ...existing,
        duplicate: true,
        warnings: [
          "相同原片已存在，标题/故事/发布状态保持不变；如需修改请使用 edit/publish",
        ],
      };
    const id = randomUUID();
    const prepared = await prepareMedia({ ...options, root, file, id });
    if (sourceSha256 !== prepared.sourceSha256)
      throw new Error("文件在导入中变化，拒绝入库");
    await transaction(conn, async (tx) => {
      await tx`INSERT INTO videos ${tx({ id, title: details.title, story: details.story ?? null, recorded_date: details.recorded_date ?? null, source_sha256: sourceSha256, status: options.publish ? "published" : "draft", published_at: options.publish ? new Date() : null })}`;
      for (const a of prepared.assets)
        await tx`INSERT INTO video_assets ${tx({ id: randomUUID(), video_id: id, kind: a.kind, object_key: a.objectKey, original_filename: a.originalFilename, mime_type: a.mimeType, size_bytes: a.sizeBytes, sha256: a.sha256, width: a.width, height: a.height, duration_ms: a.durationMs, processing_method: a.processingMethod, metadata: a.metadata === null ? null : tx.json(a.metadata) })}`;
    });
    if (options.consume) {
      if ((await hashFile(file)) !== sourceSha256)
        prepared.warnings.push(
          "incoming 文件已变化，未清理；已入库的原片副本完整保留",
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
  return withMediaLock(sql, async (conn) => {
    const [row] = await conn`SELECT id FROM videos WHERE id=${id}`;
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
      for (const asset of assets) await verifyAsset(root, asset);
    }
    await conn`UPDATE videos SET status=${status},published_at=CASE WHEN ${status}='published' THEN COALESCE(published_at,now()) ELSE published_at END,updated_at=now() WHERE id=${id}`;
    return { id, status };
  });
}

// Backfill existing videos without changing their titles, dates, publication or fallback.
export async function addNativePlayback(sql, root, id) {
  if (!uuidPattern.test(id)) throw new Error("无效的视频 ID");
  return withMediaLock(sql, async (conn) => {
    const assets = await conn`SELECT * FROM video_assets WHERE video_id=${id}`;
    if (assets.some((a) => a.kind === "native"))
      return { id, skipped: "already-present" };
    const original = assets.find((a) => a.kind === "original");
    const fallback = assets.find((a) => a.kind === "playback");
    if (!original || !fallback) throw new Error("缺少原片或兼容播放资源");
    if (["reuse", "remux"].includes(fallback.processing_method))
      return { id, skipped: "already-lossless" };
    await verifyAsset(root, original);
    const file = resolve(root, original.object_key);
    if ((await hashFile(file)) !== original.sha256)
      throw new Error("原片校验不一致");
    const work = await mkdtemp(join(root, ".work", `${id}-native-`));
    try {
      const output = join(work, "native.mp4");
      const result = await createNativePlayback({ file, output });
      if (!result) return { id, skipped: "unsupported-codec" };
      const sha256 = await hashFile(output);
      const objectKey = `playback/${id}/native-${sha256}.mp4`;
      await chmod(output, 0o644);
      const size = (await stat(output)).size;
      await rename(output, join(root, objectKey));
      await conn`INSERT INTO video_assets ${conn({ id: randomUUID(), video_id: id, kind: "native", object_key: objectKey, original_filename: null, mime_type: "video/mp4", size_bytes: size, sha256, width: result.info.video.width, height: result.info.video.height, duration_ms: Math.round(result.info.duration * 1000), processing_method: "stream-copy", metadata: conn.json({ contentType: result.contentType }) })}`;
      return { id, native: objectKey };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
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
