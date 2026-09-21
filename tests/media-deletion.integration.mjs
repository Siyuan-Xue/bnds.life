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
  addNativePlayback,
  withMediaLock,
} from "../scripts/media/store.mjs";
import { processDeletionJobs } from "../scripts/media/deletion.mjs";

test("isolated deletion queue: lock contention, crash recovery, cascades, failure/retry and no resurrection", async () => {
  assert.ok(process.env.DATABASE_URL, "需要本地测试数据库连接");
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
    async function enqueue(content, status = "pending") {
      const id = randomUUID();
      const job = randomUUID();
      const hash = createHash("sha256").update(content).digest("hex");
      await sql`INSERT INTO videos (id,title,status,source_sha256) VALUES (${id},'delete me','hidden',${hash})`;
      await sql`INSERT INTO deleted_video_sources (source_sha256) VALUES (${hash})`;
      await sql`INSERT INTO video_deletion_jobs (id,video_id,source_sha256,requested_by,status) VALUES (${job},${id},${hash},'official',${status})`;
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
      return { id, job, hash };
    }
    const first = await enqueue("original one", "running");
    await withMediaLock(sql, async () => {
      assert.equal((await processDeletionJobs(sql, root)).busy, true);
      assert.equal(
        (
          await sql`SELECT status FROM video_deletion_jobs WHERE id=${first.job}`
        )[0].status,
        "running",
      );
    });
    await assert.rejects(setStatus(sql, root, first.id, "published"));
    await assert.rejects(addNativePlayback(sql, root, first.id));
    const local = join(temp, "local-original");
    await writeFile(local, "original one");
    await assert.rejects(
      importVideo(sql, { root, file: local, title: "resurrect" }),
      { code: "VIDEO_SOURCE_DELETED" },
    );
    assert.equal(await readFile(local, "utf8"), "original one");
    const finished = await processDeletionJobs(sql, root);
    assert.equal(finished.jobs[0].status, "complete");
    assert.equal(
      (await sql`SELECT * FROM videos WHERE id=${first.id}`).length,
      0,
    );
    assert.equal(
      (await sql`SELECT * FROM video_assets WHERE video_id=${first.id}`).length,
      0,
    );
    assert.equal(
      (
        await sql`SELECT * FROM deletion_test_comments WHERE video_id=${first.id}`
      ).length,
      0,
    );
    assert.equal(
      (
        await sql`SELECT * FROM deleted_video_sources WHERE source_sha256=${first.hash}`
      ).length,
      1,
    );
    assert.equal(
      (
        await sql`SELECT status FROM video_deletion_jobs WHERE id=${first.job}`
      )[0].status,
      "complete",
    );
    assert.equal((await processDeletionJobs(sql, root)).jobs.length, 0);
    await writeFile(join(root, "incoming", "late-copy"), "original one");
    assert.equal((await processDeletionJobs(sql, root)).incomingRemoved, 1);
    await assert.rejects(
      importVideo(sql, { root, file: local, title: "resurrect" }),
      { code: "VIDEO_SOURCE_DELETED" },
    );

    const second = await enqueue("original two");
    await rm(join(root, "originals"), { recursive: true });
    const external = join(temp, "external");
    await mkdir(external);
    await writeFile(join(external, "keep"), "untouched");
    await symlink(external, join(root, "originals"));
    const failed = await processDeletionJobs(sql, root);
    assert.equal(failed.jobs[0].status, "failed");
    const [failure] =
      await sql`SELECT status,error FROM video_deletion_jobs WHERE id=${second.job}`;
    assert.equal(failure.status, "failed");
    assert.match(failure.error, /符号链接/);
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${second.id}`)[0].status,
      "hidden",
    );
    assert.equal(await readFile(join(external, "keep"), "utf8"), "untouched");
    await rm(join(root, "originals"));
    await mkdir(join(root, "originals"));
    await sql`UPDATE video_deletion_jobs SET status='pending',error=NULL WHERE id=${second.job}`;
    assert.equal(
      (await processDeletionJobs(sql, root)).jobs[0].status,
      "complete",
    );
    assert.equal((await sql`SELECT * FROM videos`).length, 0);
  } finally {
    await sql.end();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    await rm(temp, { recursive: true, force: true });
  }
});
