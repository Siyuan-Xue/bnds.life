import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/server/db/schema.ts";
import { createCommunity } from "../src/server/community.ts";
import { publicVideo } from "../src/lib/media-catalog.ts";

test("精选：官方权限、精确时长、幂等修改、元数据保留和并发下线", async () => {
  assert.ok(process.env.DATABASE_URL, "需要测试数据库连接");
  const namespace = `featured_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  await admin.unsafe(`create schema ${namespace}`);
  const sql = postgres(process.env.DATABASE_URL, {
    max: 4,
    connection: { search_path: namespace },
    onnotice: () => {},
  });
  const migration = (name) =>
    readFile(new URL(`../ops/migrations/${name}.sql`, import.meta.url), "utf8");
  try {
    for (const name of [
      "001-media",
      "003-community",
      "004-video-deletion",
      "005-single-story",
    ])
      await sql.unsafe(await migration(name));
    const existing = randomUUID();
    await sql`insert into videos(id,title,status,source_sha256) values(${existing},'迁移前视频','published',${existing})`;
    await sql.unsafe(await migration("006-featured-videos"));
    await sql.unsafe(await migration("006-featured-videos"));
    assert.equal(
      (await sql`select is_featured from videos where id=${existing}`)[0]
        .is_featured,
      false,
    );
    const db = drizzle(sql, { schema });
    const community = createCommunity(db);
    const owner = "owner",
      member = "member";
    for (const [id, official] of [
      [owner, true],
      [member, false],
    ])
      await sql`insert into "user"(id,name,email,is_official,created_at,updated_at) values(${id},${id},${id + "@example.invalid"},${official},now(),now())`;
    async function addVideo(
      originalDuration,
      playbackDuration,
      status = "published",
    ) {
      const id = randomUUID();
      await sql`insert into videos(id,title,status,source_sha256) values(${id},'精选测试',${status},${id})`;
      for (const [kind, key, duration] of [
        ["original", `originals/${id}/source.mov`, originalDuration],
        ["playback", `playback/${id}/video.mp4`, playbackDuration],
        ["poster", `posters/${id}/cover.jpg`, null],
      ])
        await sql`insert into video_assets(id,video_id,kind,object_key,mime_type,size_bytes,sha256,processing_method,duration_ms) values(${randomUUID()},${id},${kind},${key},'video/mp4',1,${id},'test',${duration})`;
      return id;
    }
    async function readPublic(id) {
      const [row] = await db
        .select()
        .from(schema.mediaVideos)
        .where(eq(schema.mediaVideos.id, id));
      const assets = await db
        .select()
        .from(schema.videoAssets)
        .where(eq(schema.videoAssets.videoId, id));
      return row ? publicVideo(row, assets) : undefined;
    }
    const long = await addVideo(60001, 59990);
    assert.equal(
      (await sql`select is_featured from videos where id=${long}`)[0]
        .is_featured,
      false,
    );
    for (const isFeatured of [true, false]) {
      await assert.rejects(
        community.setFeatured(null, { id: long, isFeatured }),
        (e) => e.code === "UNAUTHORIZED",
      );
      await assert.rejects(
        community.setFeatured(member, {
          id: long,
          isFeatured,
          isOfficial: true,
        }),
        (e) => e.code === "FORBIDDEN",
      );
    }
    for (const duration of [59999, 60000]) {
      const short = await addVideo(duration, 60020);
      await assert.rejects(
        community.setFeatured(owner, { id: short, isFeatured: true }),
        (e) => e.code === "BAD_REQUEST",
      );
    }
    for (const status of ["draft", "hidden"])
      await assert.rejects(
        community.setFeatured(owner, {
          id: await addVideo(60001, 60001, status),
          isFeatured: true,
        }),
        (e) => e.code === "NOT_FOUND",
      );
    const invalid = await addVideo(null, 0);
    await assert.rejects(
      community.setFeatured(owner, { id: invalid, isFeatured: true }),
      (e) => e.code === "BAD_REQUEST",
    );
    await assert.rejects(
      community.setFeatured(owner, { id: "not-a-uuid", isFeatured: true }),
      (e) => e.code === "BAD_REQUEST",
    );
    await assert.rejects(
      community.setFeatured(owner, { id: long, isFeatured: "true" }),
      (e) => e.code === "BAD_REQUEST",
    );
    await assert.rejects(
      community.setFeatured(owner, { id: randomUUID(), isFeatured: true }),
      (e) => e.code === "NOT_FOUND",
    );
    for (let i = 0; i < 2; i++)
      assert.deepEqual(
        await community.setFeatured(owner, { id: long, isFeatured: true }),
        { isFeatured: true },
      );
    assert.equal((await readPublic(long)).isFeatured, true);
    await community.update(owner, {
      id: long,
      title: "更新后精选",
      recordedAt: "2021-06",
    });
    assert.equal((await readPublic(long)).isFeatured, true);
    assert.equal((await readPublic(long)).title, "更新后精选");
    for (let i = 0; i < 2; i++)
      assert.deepEqual(
        await community.setFeatured(owner, { id: long, isFeatured: false }),
        { isFeatured: false },
      );
    assert.equal((await readPublic(long)).isFeatured, undefined);
    const fallback = await addVideo(null, 60001);
    assert.deepEqual(
      await community.setFeatured(owner, { id: fallback, isFeatured: true }),
      { isFeatured: true },
    );
    // Recheck authority for each call, even if a prior request was official.
    await sql`update "user" set is_official=false where id=${owner}`;
    await assert.rejects(
      community.setFeatured(owner, { id: fallback, isFeatured: false }),
      (e) => e.code === "FORBIDDEN",
    );
    await sql`update "user" set is_official=true where id=${owner}`;
    // Both writes serialize on videos. Whichever wins, the result is hidden.
    const raced = await Promise.allSettled([
      community.setFeatured(owner, { id: long, isFeatured: true }),
      community.offline(owner, long),
    ]);
    assert.equal(raced[1].status, "fulfilled");
    if (raced[0].status === "rejected")
      assert.equal(raced[0].reason.code, "NOT_FOUND");
    assert.equal(
      (await sql`select status from videos where id=${long}`)[0].status,
      "hidden",
    );
    assert.equal(await readPublic(long), undefined);
    for (const isFeatured of [true, false])
      await assert.rejects(
        community.setFeatured(owner, { id: long, isFeatured }),
        (e) => e.code === "NOT_FOUND",
      );
    const waiting = await addVideo(60001, 60001);
    let pendingFeature;
    await sql.begin(async (tx) => {
      await tx`update videos set status='hidden' where id=${waiting}`;
      const [{ pid }] = await tx`select pg_backend_pid() as pid`;
      pendingFeature = community
        .setFeatured(owner, { id: waiting, isFeatured: true })
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (Date.now() < deadline) {
        const [{ waiting: count }] =
          await sql`select count(*)::int as waiting from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))`;
        if (count > 0) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(blocked, "精选操作需等待视频行的下线事务");
    });
    assert.equal(
      (await pendingFeature).error?.code,
      "NOT_FOUND",
      "等待锁后必须重新检查发布状态",
    );
    assert.equal(
      (await sql`select is_featured from videos where id=${waiting}`)[0]
        .is_featured,
      false,
    );
  } finally {
    await sql.end();
    await admin.unsafe(`drop schema ${namespace} cascade`);
    await admin.end();
  }
});
