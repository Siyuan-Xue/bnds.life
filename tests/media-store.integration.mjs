import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, mkdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { sourceReceipts } from "../scripts/media/source-retention.mjs";
import {
  migrate,
  importVideo,
  setStatus,
  editVideo,
  withMediaLock,
  addNativePlayback,
} from "../scripts/media/store.mjs";

test("隔离数据库：迁移幂等、重复导入保留编辑、显式发布隐藏与缺失资源拒绝发布", async () => {
  assert.ok(process.env.DATABASE_URL, "需要专用测试连接或 .env");
  const schema = `media_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  const root = await mkdtemp(join(tmpdir(), "bnds-store-test-"));
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  const sql = postgres(process.env.DATABASE_URL, {
    max: 2,
    connection: { search_path: schema },
    onnotice: () => {},
  });
  try {
    await migrate(sql);
    await migrate(sql);
    await withMediaLock(sql, async () => {
      await assert.rejects(
        withMediaLock(sql, async () => {}),
        /另一项/,
      );
    });
    await assert.rejects(
      importVideo(sql, {
        root,
        file: resolve("public/media/placeholder-landscape.mp4"),
        title: "bad",
        recordedAt: "2021-02-30",
      }),
      /日期/,
    );
    const first = await importVideo(sql, {
      root,
      file: resolve("public/media/placeholder-landscape.mp4"),
      title: "测试片",
      recordedAt: "2021-06",
    });
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${first.id}`)[0].status,
      "draft",
    );
    await assert.rejects(stat(join(root, "originals", first.id)), {
      code: "ENOENT",
    });
    await editVideo(sql, first.id, {
      title: "修改后",
      story: "真实故事",
      recordedAt: "2021-06-03",
    });
    const duplicate = await importVideo(sql, {
      root,
      file: resolve("public/media/placeholder-landscape.mp4"),
      title: "不覆盖",
    });
    assert.equal(duplicate.id, first.id);
    assert.equal(duplicate.duplicate, true);
    assert.equal((await sql`SELECT title FROM videos`)[0].title, "修改后");
    assert.equal(
      Number((await sql`SELECT count(*) FROM video_assets`)[0].count),
      3,
    );
    await sql`ALTER TABLE video_assets ADD CONSTRAINT test_reject_poster CHECK (kind <> 'poster') NOT VALID`;
    await assert.rejects(
      importVideo(sql, {
        root,
        file: resolve("public/media/placeholder-portrait.mp4"),
        title: "不应留下半条记录",
        publish: true,
      }),
    );
    assert.equal(Number((await sql`SELECT count(*) FROM videos`)[0].count), 1);
    assert.equal(
      Number((await sql`SELECT count(*) FROM video_assets`)[0].count),
      3,
    );
    await sql`ALTER TABLE video_assets DROP CONSTRAINT test_reject_poster`;
    await setStatus(sql, root, first.id, "published");
    assert.equal((await sql`SELECT status FROM videos`)[0].status, "published");
    await setStatus(sql, root, first.id, "hidden");
    const playback = (
      await sql`SELECT object_key FROM video_assets WHERE kind='playback'`
    )[0];
    await rm(join(root, playback.object_key));
    await assert.rejects(setStatus(sql, root, first.id, "published"));
    assert.equal((await sql`SELECT status FROM videos`)[0].status, "hidden");
    const hevc = join(root, "native-camera.mov");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=160x90:rate=12",
      "-t",
      "0.5",
      "-c:v",
      "libx265",
      "-x265-params",
      "pools=1:frame-threads=1:log-level=error",
      hevc,
    ]);
    const second = await importVideo(sql, {
      root,
      file: hevc,
      title: "原画",
      recordedAt: "2023-07-18",
    });
    assert.equal(
      Number(
        (
          await sql`SELECT count(*) FROM video_assets WHERE video_id=${second.id}`
        )[0].count,
      ),
      4,
    );
    await setStatus(sql, root, second.id, "published");
    await sql`DELETE FROM video_assets WHERE video_id=${second.id} AND kind='native'`;
    await assert.rejects(
      addNativePlayback(sql, root, second.id),
      /服务器不保留原片.*--file/,
    );
    await assert.rejects(
      addNativePlayback(sql, root, second.id, {
        file: resolve("public/media/placeholder-landscape.mp4"),
      }),
      /校验不一致/,
    );
    assert.ok(
      (await addNativePlayback(sql, root, second.id, { file: hevc })).native,
    );
    assert.equal(
      (await addNativePlayback(sql, root, second.id)).skipped,
      "already-present",
    );
    assert.equal(
      Number(
        (
          await sql`SELECT count(*) FROM video_assets WHERE video_id=${second.id}`
        )[0].count,
      ),
      4,
    );
    assert.equal(
      (await sql`SELECT status FROM videos WHERE id=${second.id}`)[0].status,
      "published",
    );
    await mkdir(join(root, "incoming"), { recursive: true });
    const incoming = join(root, "incoming", "copy.mov");
    await copyFile(hevc, incoming);
    const duplicateConsumed = await importVideo(sql, {
      root,
      file: incoming,
      consume: true,
    });
    assert.equal(duplicateConsumed.duplicate, true);
    await assert.rejects(stat(incoming), { code: "ENOENT" });
    await mkdir(join(root, "originals", second.id), { recursive: true });
    await copyFile(hevc, join(root, "originals", second.id, "source.mov"));
    await assert.rejects(
      sourceReceipts(sql, root, { execute: true }),
      /未删除任何原片/,
    );
    assert.ok(
      (await stat(join(root, "originals", second.id, "source.mov"))).size > 0,
    );
    await sql`INSERT INTO deleted_video_sources (source_sha256) SELECT source_sha256 FROM videos WHERE id=${first.id}`;
    const receipts = await sourceReceipts(sql, root, { execute: true });
    assert.equal(receipts.verified.length, 1);
    assert.equal(receipts.rejected.length, 0);
    await assert.rejects(stat(join(root, "originals", second.id)), {
      code: "ENOENT",
    });
    await setStatus(sql, root, second.id, "published");
    await migrate(sql);
  } finally {
    await sql.end();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    await rm(root, { recursive: true, force: true });
  }
});
