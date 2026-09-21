import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema.ts";
import { createCommunity } from "../src/server/community.ts";
import { createSiteAuth } from "../src/server/better-auth/options.ts";

test("账户与讨论：权限、身份伪造、回复、故事、日期及删除任务", async () => {
  const namespace = "community_test_" + randomUUID().replaceAll("-", "");
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
  try {
    for (const name of [
      "001-media",
      "003-community",
      "004-video-deletion",
      "005-single-story",
      "006-featured-videos",
    ])
      await sql.unsafe(
        await readFile(
          new URL("../ops/migrations/" + name + ".sql", import.meta.url),
          "utf8",
        ),
      );
    const db = drizzle(sql, { schema });
    const c = createCommunity(db);
    const auth = createSiteAuth(
      db,
      "http://localhost:3000",
      "test-secret-long-enough-for-better-auth-123",
    );
    const signup = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "普通同学",
          email: "student@example.invalid",
          password: "test-password-12345",
          isOfficial: true,
        }),
      }),
    );
    assert.equal(signup.status, 200);
    const result = await signup.json();
    const uid = result.user.id;
    assert.equal((await c.viewer(uid)).isOfficial, false);
    assert.equal(
      (await sql`select email_verified from "user" where id=${uid}`)[0]
        .email_verified,
      false,
    );
    assert.ok(signup.headers.get("set-cookie"));
    const login = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "student@example.invalid",
          password: "test-password-12345",
        }),
      }),
    );
    assert.equal(login.status, 200, "未验证邮箱也能登录");
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const forged = await auth.handler(
      new Request("http://localhost:3000/api/auth/update-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({ isOfficial: true }),
      }),
    );
    assert.equal(forged.status, 400);
    assert.equal((await c.viewer(uid)).isOfficial, false);

    const reserved = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "OFFICIAL",
          email: "fake@example.invalid",
          password: "test-password-12345",
        }),
      }),
    );
    assert.equal(reserved.status, 400);
    const official = "official-test";
    await sql`insert into "user"(id,name,email,email_verified,is_official,created_at,updated_at) values(${official},'official','owner@example.invalid',false,true,now(),now())`;
    const a = randomUUID(),
      b = randomUUID();
    for (const id of [a, b])
      await sql`insert into videos(id,title,status,source_sha256) values(${id},'视频','published',${id})`;
    await assert.rejects(
      c.add(null, { videoId: a, body: "匿名" }),
      (e) => e.code === "UNAUTHORIZED",
    );
    await assert.rejects(
      c.update(uid, { id: a, title: "不允许", recordedAt: null }),
      (e) => e.code === "FORBIDDEN",
    );
    await assert.rejects(c.offline(uid, a), (e) => e.code === "FORBIDDEN");
    const root = await c.add(uid, {
      videoId: a,
      body: "<script>保留纯文本</script>",
    });
    await assert.rejects(
      c.add(uid, { videoId: a, body: "太快" }),
      (e) => e.code === "TOO_MANY_REQUESTS",
    );
    await sql`update video_comments set created_at=now()-interval '1 minute'`;
    await assert.rejects(
      c.add(uid, { videoId: b, body: "跨视频", parentId: root.id }),
      (e) => e.code === "BAD_REQUEST",
    );
    const story = await c.saveStory(official, { videoId: a, body: "官方故事" });
    assert.equal((await c.stories(a))[0].id, story.id);
    assert.equal((await c.list({ videoId: a })).items.length, 1);
    await sql`update video_comments set created_at=now()-interval '1 minute'`;
    const reply = await c.add(uid, {
      videoId: a,
      body: "回复同学",
      parentId: root.id,
    });
    await sql`update video_comments set created_at=now()-interval '1 minute'`;
    await c.add(uid, { videoId: a, body: "回复回复", parentId: reply.id });
    assert.equal(
      (await c.list({ videoId: a, parentId: root.id })).items.length,
      2,
    );
    assert.equal((await c.list({ videoId: a })).items[0].replyCount, 2);
    assert.equal(
      "email" in (await c.list({ videoId: a })).items[0].author,
      false,
    );
    await assert.rejects(
      c.update(official, {
        id: a,
        title: "日期错误",
        recordedAt: "2023-02-30",
      }),
      (e) => e.code === "BAD_REQUEST",
    );
    assert.equal(
      (
        await c.update(official, {
          id: a,
          title: "改名",
          recordedAt: "2023-02",
        })
      ).recordedAt,
      "2023-02",
    );
    const job = await c.offline(official, a);
    assert.equal(job.status, "pending");
    assert.equal((await c.offline(official, a)).jobId, job.jobId);
    assert.equal(
      (await sql`select status from videos where id=${a}`)[0].status,
      "hidden",
    );
    assert.equal(
      (await sql`select count(*) from deleted_video_sources`)[0].count,
      "0",
    );
    await assert.rejects(
      c.add(uid, { videoId: a, body: "已删除" }),
      (e) => e.code === "NOT_FOUND",
    );
    await assert.rejects(
      c.deletion(uid, job.jobId),
      (e) => e.code === "FORBIDDEN",
    );
    assert.equal((await c.deletion(official, job.jobId)).status, "pending");
    await assert.rejects(c.offlineVideos(uid), (e) => e.code === "FORBIDDEN");
    assert.equal((await c.offlineVideos(official))[0].jobId, job.jobId);
    await sql`update video_deletion_jobs set status='failed' where id=${job.jobId}`;
    assert.equal((await c.offline(official, a)).status, "failed");
    for (let n = 0; n < 25; n++)
      await sql`insert into video_comments(id,video_id,user_id,body,created_at) values(${randomUUID()},${b},${uid},${"分页" + n},'2026-01-01 00:00:00.123456+00')`;
    const firstPage = await c.list({ videoId: b });
    const secondPage = await c.list({
      videoId: b,
      cursor: firstPage.nextCursor,
    });
    assert.equal(firstPage.items.length, 20);
    assert.equal(secondPage.items.length, 5);
    assert.equal(
      new Set([...firstPage.items, ...secondPage.items].map((x) => x.id)).size,
      25,
    );
  } finally {
    await sql.end();
    await admin.unsafe(`drop schema ${namespace} cascade`);
    await admin.end();
  }
});
