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
// Retirement removes only legacy camera archives, never playable assets or rows.
export async function removeOriginalFiles(root, id) {
  if (!uuidPattern.test(id)) throw new Error("无效的视频 ID");
  root = await deletionRoot(root);
  if (await mediaDirectory(root, "originals"))
    await removeTree(root, ["originals", id]);
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

export function cleanupCutoff(retentionDays = 7, now = new Date()) {
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 0 ||
    retentionDays > 36500
  )
    throw new Error("MEDIA_CLEANUP_RETENTION_DAYS 必须是 0–36500 的整数");
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("无效的清理时间");
  return new Date(timestamp - retentionDays * 24 * 60 * 60 * 1000);
}

async function cleanupCandidate(conn, id, cutoff) {
  // Use the same lock ordering as offline/publish: video first, then job.
  const [candidate] =
    await conn`SELECT video_id FROM video_deletion_jobs WHERE id=${id}`;
  if (!candidate) return null;
  const [video] =
    await conn`SELECT id,status,source_sha256 FROM videos WHERE id=${candidate.video_id} FOR UPDATE`;
  const [job] =
    await conn`SELECT * FROM video_deletion_jobs WHERE id=${id} FOR UPDATE`;
  if (
    !video ||
    video.status !== "hidden" ||
    !job ||
    !["pending", "running", "failed"].includes(job.status) ||
    (job.status !== "running" && new Date(job.created_at) > cutoff)
  )
    return null;
  if (job.video_id !== video.id || video.source_sha256 !== job.source_sha256)
    throw new Error("清理任务原片哈希与视频不一致，保留所有文件");
  if (!uuidPattern.test(job.video_id) || !shaPattern.test(job.source_sha256))
    throw new Error("无效的清理任务");
  return job;
}

export async function processDeletionJobs(
  sql,
  root,
  { sweep = true, retentionDays = 7, now = new Date() } = {},
) {
  const cutoff = cleanupCutoff(retentionDays, now);
  try {
    return await withMediaLock(sql, async (conn) => {
      const jobs =
        await conn`SELECT j.id FROM video_deletion_jobs j JOIN videos v ON v.id=j.video_id
        WHERE v.status='hidden' AND j.status IN ('pending','running','failed')
        AND (j.status='running' OR j.created_at<=${cutoff}) ORDER BY j.created_at,j.id`;
      const results = [];
      for (const candidate of jobs) {
        try {
          // Persist the irreversible cleanup marker before touching files so a
          // crash cannot allow a partially cleaned source to be imported again.
          await conn`BEGIN`;
          let job;
          try {
            job = await cleanupCandidate(conn, candidate.id, cutoff);
            if (job) {
              await conn`INSERT INTO deleted_video_sources (source_sha256) VALUES (${job.source_sha256}) ON CONFLICT DO NOTHING`;
              await conn`UPDATE video_deletion_jobs SET status='running',error=NULL,updated_at=now() WHERE id=${job.id}`;
            }
            await conn`COMMIT`;
          } catch (error) {
            await conn`ROLLBACK`;
            throw error;
          }
          if (!job) continue;
          // Recheck after acquiring the row lock again, and hold it throughout
          // physical cleanup. Publication can never race the filesystem writes.
          await conn`BEGIN`;
          let files;
          try {
            job = await cleanupCandidate(conn, candidate.id, cutoff);
            if (job) {
              files = await deleteVideoFiles(
                root,
                job.video_id,
                job.source_sha256,
              );
              await conn`DELETE FROM videos WHERE id=${job.video_id}`;
              await conn`UPDATE video_deletion_jobs SET status='complete',error=NULL,updated_at=now() WHERE id=${job.id}`;
            }
            await conn`COMMIT`;
          } catch (error) {
            await conn`ROLLBACK`;
            throw error;
          }
          if (job) results.push({ id: job.id, status: "complete", ...files });
        } catch (error) {
          await conn`UPDATE video_deletion_jobs SET status='failed',error=${String(error.message).slice(0, 2000)},updated_at=now() WHERE id=${candidate.id}`;
          results.push({
            id: candidate.id,
            status: "failed",
            error: error.message,
          });
        }
      }
      // Daily cleanup also removes uploads arriving after an earlier physical
      // cleanup. Any surviving video row protects incoming copies, including
      // legacy tombstones created before the offline retention policy.
      const tombstones =
        await conn`SELECT d.source_sha256 FROM deleted_video_sources d
        WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.source_sha256=d.source_sha256)`;
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
        cutoff: cutoff.toISOString(),
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
