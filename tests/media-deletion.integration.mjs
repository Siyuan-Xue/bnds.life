import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  migrate,
  importVideo,
  setStatus,
  withMediaLock,
} from "../scripts/media/store.mjs";
import { processDeletionJobs } from "../scripts/media/deletion.mjs";

test("scheduled cleanup: retention, hidden state, hash guard, crash recovery, automatic retry and tombstones", async () => {
  assert.ok(process.env.DATABASE_URL, "需要测试数据库连接");
  const schema = `deletion_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  const temp = await mkdtemp(join(tmpdir(), "bnds-delete-db-"));
  const root = join(temp, "media");
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  const sql = postgres(process.env.DATABASE_URL, {
    max: 2,
    connection: { search_path: schema },
    onnotice: () => {},
  });
  const now = new Date();
  const ago = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const run = () => processDeletionJobs(sql, root, { now });
  try {
    await migrate(sql);
    await migrate(sql);
    await sql`CREATE TABLE deletion_test_comments (id uuid PRIMARY KEY,video_id uuid REFERENCES videos(id) ON DELETE CASCADE)`;
    for (const folder of [
      "originals",
      "playback",
      "posters",
      ".work",
      "incoming",
    ])
      await mkdir(join(root, folder), { recursive: true });
    async function enqueue(
      content,
      {
        status = "pending",
        videoStatus = "hidden",
        days = 8,
        mismatch = false,
      } = {},
    ) {
      const id = randomUUID();
      const job = randomUUID();
      const hash = createHash("sha256").update(content).digest("hex");
      const jobHash = mismatch ? "a".repeat(64) : hash;
      await sql`INSERT INTO videos (id,title,status,source_sha256) VALUES (${id},'offline video',${videoStatus},${hash})`;
      // Taking a video offline queues cleanup, but never creates a tombstone.
      await sql`INSERT INTO video_deletion_jobs (id,video_id,source_sha256,requested_by,status,created_at) VALUES (${job},${id},${jobHash},'official',${status},${ago(days)})`;
      await sql`INSERT INTO deletion_test_comments (id,video_id) VALUES (${randomUUID()},${id})`;
      for (const [folder, kind] of [
        ["originals", "original"],
        ["playback", "playback"],
        ["posters", "poster"],
      ]) {
        await mkdir(join(root, folder, id));
        await writeFile(join(root, folder, id, "file"), content);
        await writeFile(join(root, folder, id, "obsolete"), "unreferenced");
        await sql`INSERT INTO video_assets (id,video_id,kind,object_key,mime_type,size_bytes,sha256,processing_method) VALUES (${randomUUID()},${id},${kind},${`${folder}/${id}/file`},'video/mp4',${content.length},${hash},'test')`;
      }
      await writeFile(join(root, "incoming", `${id}.uploading`), content);
      return { id, job, hash, content };
    }
    const old = await enqueue("older offline original");
    const exactCutoff = await enqueue("exactly seven full days", { days: 7 });
    const recent = await enqueue("recent offline original", { days: 1 });
    const justBeforeCutoff = await enqueue("not yet seven full days", {
      days: 7 - 1 / 86400000,
    });
    const published = await enqueue("published original", {
      videoStatus: "published",
    });
    const mismatched = await enqueue("mismatched source original", {
      mismatch: true,
    });
    const recovered = await enqueue("cleanup interrupted original", {
      status: "running",
      days: 1,
    });
    await withMediaLock(sql, async () =>
      assert.equal((await run()).busy, true),
    );
    assert.equal((await sql`SELECT * FROM deleted_video_sources`).length, 0);
    const legacy = await enqueue("legacy tombstoned recent offline original", {
      days: 1,
    });
    await sql`INSERT INTO deleted_video_sources (source_sha256) VALUES (${legacy.hash})`;
    await assert.rejects(
      importVideo(sql, {
        root,
        file: join(root, "incoming", `${legacy.id}.uploading`),
        title: "legacy source retry",
        consume: true,
      }),
      { code: "VIDEO_SOURCE_DELETED" },
    );
    assert.equal(
      await readFile(join(root, "incoming", `${legacy.id}.uploading`), "utf8"),
      legacy.content,
    );
    const result = await run();
    assert.equal(
      await readFile(join(root, "incoming", `${legacy.id}.uploading`), "utf8"),
      legacy.content,
    );
    assert.equal(
      await readFile(join(root, "originals", legacy.id, "file"), "utf8"),
      legacy.content,
    );
    assert.equal(
      (
        await sql`SELECT status FROM video_deletion_jobs WHERE id=${legacy.job}`
      )[0].status,
      "pending",
    );
    // A legacy tombstone must not bypass retention; its main job cleans up only
    // after the video has been offline for the complete retention interval.
    await sql`UPDATE video_deletion_jobs SET created_at=${ago(8)} WHERE id=${legacy.job}`;
    assert.equal(
      (await run()).jobs.find((job) => job.id === legacy.job).status,
      "complete",
    );
    await assert.rejects(
      readFile(join(root, "incoming", `${legacy.id}.uploading`)),
      { code: "ENOENT" },
    );
    assert.equal(
      result.jobs.find((job) => job.id === old.job).status,
      "complete",
    );
    assert.equal(
      result.jobs.find((job) => job.id === recovered.job).status,
      "complete",
    );
    assert.equal(
      result.jobs.find((job) => job.id === mismatched.job).status,
      "failed",
    );
    assert.match(
      result.jobs.find((job) => job.id === mismatched.job).error,
      /哈希/,
    );
    for (const entry of [recent, justBeforeCutoff, published, mismatched]) {
      assert.equal(
        await readFile(join(root, "originals", entry.id, "file"), "utf8"),
        entry.content,
      );
      assert.equal(
        await readFile(join(root, "incoming", `${entry.id}.uploading`), "utf8"),
        entry.content,
      );
      assert.equal(
        (await sql`SELECT * FROM videos WHERE id=${entry.id}`).length,
        1,
      );
      assert.equal(
        (
          await sql`SELECT * FROM deleted_video_sources WHERE source_sha256=${entry.hash}`
        ).length,
        0,
      );
    }
    assert.equal(
      (
        await sql`SELECT * FROM deleted_video_sources WHERE source_sha256=${"a".repeat(64)}`
      ).length,
      0,
    );
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${published.id}`)[0].status,
      "published",
    );
    for (const entry of [old, exactCutoff, recovered]) {
      assert.equal(
        (await sql`SELECT * FROM videos WHERE id=${entry.id}`).length,
        0,
      );
      assert.equal(
        (await sql`SELECT * FROM video_assets WHERE video_id=${entry.id}`)
          .length,
        0,
      );
      assert.equal(
        (
          await sql`SELECT * FROM deletion_test_comments WHERE video_id=${entry.id}`
        ).length,
        0,
      );
      assert.equal(
        (
          await sql`SELECT * FROM deleted_video_sources WHERE source_sha256=${entry.hash}`
        ).length,
        1,
      );
    }
    // Offline-only videos remain publishable before their retention expires.
    await setStatus(sql, root, recent.id, "published");
    await sql`UPDATE video_deletion_jobs SET created_at=${ago(8)} WHERE id=${recent.job}`;
    await run();
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${recent.id}`)[0].status,
      "published",
    );
    const local = join(temp, "local-original");
    await writeFile(local, old.content);
    await assert.rejects(
      importVideo(sql, { root, file: local, title: "resurrect" }),
      { code: "VIDEO_SOURCE_DELETED" },
    );
    assert.equal(await readFile(local, "utf8"), old.content);
    await writeFile(join(root, "incoming", "late-copy"), old.content);
    assert.equal((await run()).incomingRemoved, 1);

    const retry = await enqueue("retry cleanup original");
    const originalDir = join(root, "originals", retry.id);
    await rm(originalDir, { recursive: true });
    const external = join(temp, "external");
    await mkdir(external);
    await writeFile(join(external, "keep"), "untouched");
    // A storage parent symlink fails safely before any UUID file is removed.
    const originalsBackup = join(root, "originals-save");
    const { rename } = await import("node:fs/promises");
    await rename(join(root, "originals"), originalsBackup);
    await symlink(external, join(root, "originals"));
    const failed = await run();
    assert.equal(
      failed.jobs.find((job) => job.id === retry.job).status,
      "failed",
    );
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${retry.id}`)[0].status,
      "hidden",
    );
    assert.equal(await readFile(join(external, "keep"), "utf8"), "untouched");
    await rm(join(root, "originals"));
    await rename(originalsBackup, join(root, "originals"));
    // No manual status reset: the next scheduled invocation retries failed jobs.
    assert.equal(
      (await run()).jobs.find((job) => job.id === retry.job).status,
      "complete",
    );
    assert.equal(
      (await sql`SELECT * FROM videos WHERE id=${retry.id}`).length,
      0,
    );
    assert.equal(
      (await run()).jobs.filter((job) => job.status === "complete").length,
      0,
    );
  } finally {
    await sql.end();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    await rm(temp, { recursive: true, force: true });
  }
});
