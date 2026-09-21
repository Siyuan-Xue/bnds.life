import { constants } from "node:fs";
import {
  lstat,
  open,
  readdir,
  realpath,
  rmdir,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { uuidPattern } from "./files.mjs";
import { withMediaLock } from "./store.mjs";

const shaPattern = /^[0-9a-f]{64}$/;
// Cache only unchanged nonmatching files; matching files are always rehashed.
const incomingHashCache = new Map();
async function info(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
export async function deletionRoot(root) {
  if (!root || !isAbsolute(root) || resolve(root) === sep)
    throw new Error("MEDIA_ROOT 必须是专用媒体目录的绝对路径");
  const entry = await lstat(root);
  if (!entry.isDirectory() || entry.isSymbolicLink())
    throw new Error("媒体根目录不能是符号链接");
  return realpath(root);
}
async function checkedPath(root, parts) {
  const path = resolve(root, ...parts);
  const rel = relative(root, path);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel))
    throw new Error("媒体删除路径越界");
  let parent = root;
  for (const name of rel.split(sep).slice(0, -1)) {
    parent = join(parent, name);
    const entry = await info(parent);
    if (!entry) return null;
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("媒体删除路径包含符号链接或非目录");
  }
  return path;
}
// Never follows symlinks, including obsolete files not referenced by video_assets.
async function removeTree(root, parts) {
  const path = await checkedPath(root, parts);
  if (!path) return;
  const entry = await info(path);
  if (!entry) return;
  if (entry.isDirectory() && !entry.isSymbolicLink()) {
    for (const name of await readdir(path))
      await removeTree(root, [...parts, name]);
    const checked = await checkedPath(root, parts);
    if (checked) await rmdir(checked);
  } else {
    await unlink(path);
  }
}
async function mediaDirectory(root, name) {
  const path = await checkedPath(root, [name]);
  const entry = await info(path);
  if (!entry) return null;
  if (!entry.isDirectory() || entry.isSymbolicLink())
    throw new Error(`媒体目录不能是符号链接或非目录：${name}`);
  return path;
}
function sameFile(a, b) {
  return (
    b &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs
  );
}
// Hash a stable, non-symlink file handle and recheck its identity before unlink.
async function removeMatchingFile(root, parts, hashes) {
  const path = await checkedPath(root, parts);
  if (!path) return false;
  const before = await info(path);
  if (!before?.isFile() || before.isSymbolicLink()) return false;
  const cached = incomingHashCache.get(path);
  if (cached && sameFile(before, cached.stat) && !hashes.has(cached.hash))
    return false;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!sameFile(before, opened)) return false;
    const hash = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false }))
      hash.update(chunk);
    const digest = hash.digest("hex");
    if (!sameFile(opened, await handle.stat())) return false;
    if (incomingHashCache.size >= 10000) incomingHashCache.clear();
    incomingHashCache.set(path, { stat: opened, hash: digest });
    if (!hashes.has(digest)) return false;
    const current = await checkedPath(root, parts);
    if (!current || !sameFile(opened, await info(current))) return false;
    await unlink(current);
    incomingHashCache.delete(path);
    return true;
  } catch (error) {
    if (["ENOENT", "ELOOP"].includes(error.code)) return false;
    throw error;
  } finally {
    await handle?.close();
  }
}
export async function removeDeletedIncoming(root, hashes) {
  root = await deletionRoot(root);
  const targets = new Set(hashes);
  if ([...targets].some((hash) => !shaPattern.test(hash)))
    throw new Error("无效的原片哈希");
  if (!targets.size || !(await mediaDirectory(root, "incoming"))) return 0;
  let removed = 0;
  async function walk(parts) {
    const path = await checkedPath(root, parts);
    if (!path) return;
    const entry = await info(path);
    if (!entry || entry.isSymbolicLink()) return;
    if (entry.isDirectory()) {
      for (const name of await readdir(path)) await walk([...parts, name]);
    } else if (
      entry.isFile() &&
      (await removeMatchingFile(root, parts, targets))
    )
      removed++;
  }
  await walk(["incoming"]);
  return removed;
}
export async function deleteVideoFiles(root, id, sourceSha256) {
  if (!uuidPattern.test(id) || !shaPattern.test(sourceSha256))
    throw new Error("无效的删除任务");
  root = await deletionRoot(root);
  for (const name of ["originals", "playback", "posters"]) {
    if (await mediaDirectory(root, name)) await removeTree(root, [name, id]);
  }
  const work = await mediaDirectory(root, ".work");
  if (work) {
    for (const name of await readdir(work))
      if (name.startsWith(`${id}-`)) await removeTree(root, [".work", name]);
  }
  return { incomingRemoved: await removeDeletedIncoming(root, [sourceSha256]) };
}

export async function processDeletionJobs(sql, root, { sweep = true } = {}) {
  try {
    return await withMediaLock(sql, async (conn) => {
      const jobs =
        await conn`SELECT * FROM video_deletion_jobs WHERE status IN ('pending','running') ORDER BY created_at,id`;
      const results = [];
      for (const job of jobs) {
        try {
          await conn`BEGIN`;
          try {
            await conn`INSERT INTO deleted_video_sources (source_sha256) VALUES (${job.source_sha256}) ON CONFLICT DO NOTHING`;
            await conn`UPDATE videos SET status='hidden',updated_at=now() WHERE id=${job.video_id}`;
            await conn`UPDATE video_deletion_jobs SET status='running',error=NULL,updated_at=now() WHERE id=${job.id}`;
            await conn`COMMIT`;
          } catch (error) {
            await conn`ROLLBACK`;
            throw error;
          }
          const files = await deleteVideoFiles(
            root,
            job.video_id,
            job.source_sha256,
          );
          await conn`BEGIN`;
          try {
            await conn`DELETE FROM videos WHERE id=${job.video_id}`;
            await conn`UPDATE video_deletion_jobs SET status='complete',error=NULL,updated_at=now() WHERE id=${job.id}`;
            await conn`COMMIT`;
          } catch (error) {
            await conn`ROLLBACK`;
            throw error;
          }
          results.push({ id: job.id, status: "complete", ...files });
        } catch (error) {
          await conn`UPDATE video_deletion_jobs SET status='failed',error=${String(error.message).slice(0, 2000)},updated_at=now() WHERE id=${job.id}`;
          results.push({ id: job.id, status: "failed", error: error.message });
        }
      }
      // Uploads may finish after the deletion job. Persistent tombstones also
      // clean those exact copies, including complete .uploading files.
      const tombstones =
        await conn`SELECT source_sha256 FROM deleted_video_sources`;
      let incomingRemoved = 0;
      let sweepError;
      try {
        if (sweep)
          incomingRemoved = await removeDeletedIncoming(
            root,
            tombstones.map((row) => row.source_sha256),
          );
      } catch (error) {
        sweepError = error.message;
      }
      return {
        busy: false,
        jobs: results,
        incomingRemoved,
        ...(sweepError ? { sweepError } : {}),
      };
    });
  } catch (error) {
    if (error.code === "MEDIA_LOCK_BUSY") return { busy: true, jobs: [] };
    throw error;
  }
}
