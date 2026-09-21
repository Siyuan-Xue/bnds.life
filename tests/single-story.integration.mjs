import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema.ts";
import { createCommunity } from "../src/server/community.ts";
test("one editable story, many ordinary comments, preserved replies and concurrent creation guard", async () => {
  const ns = "story_test_" + randomUUID().replaceAll("-", "");
  const admin = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  await admin.unsafe(`create schema ${ns}`);
  const sql = postgres(process.env.DATABASE_URL, {
    max: 4,
    connection: { search_path: ns },
    onnotice: () => {},
  });
  const migrate = async (name) =>
    sql.unsafe(
      await readFile(
        new URL(`../ops/migrations/${name}.sql`, import.meta.url),
        "utf8",
      ),
    );
  try {
    for (const n of ["001-media", "003-community", "004-video-deletion"])
      await migrate(n);
    const c = createCommunity(drizzle(sql, { schema }));
    assert.equal(typeof c.saveStory, "function");
    const owner = "owner",
      member = "member",
      video = randomUUID(),
      legacy = randomUUID(),
      old = randomUUID();
    for (const [id, official] of [
      [owner, true],
      [member, false],
    ])
      await sql`insert into "user"(id,name,email,is_official,created_at,updated_at) values(${id},${id},${id + "@example.invalid"},${official},now(),now())`;
    for (const id of [video, legacy, old])
      await sql`insert into videos(id,title,status,source_sha256) values(${id},'测试','published',${id})`;
    await sql`update videos set story='旧故事' where id=${legacy}`;
    const oldStory = randomUUID(),
      oldExtra = randomUUID(),
      oldReply = randomUUID();
    await sql`insert into video_comments(id,video_id,user_id,body,created_at) values(${oldStory},${old},${owner},'原故事','2020-01-01'),(${oldExtra},${old},${owner},'保留为评论','2020-01-02')`;
    await sql`insert into video_comments(id,video_id,user_id,parent_id,body,created_at) values(${oldReply},${old},${member},${oldStory},'原回复','2020-01-03')`;
    await migrate("005-single-story");
    assert.equal((await c.stories(legacy))[0].body, "旧故事");
    assert.equal((await c.stories(old))[0].id, oldStory);
    assert.equal((await c.list({ videoId: old })).items[0].id, oldReply);
    assert.equal((await c.stories(old))[0].body, "原故事\n\n保留为评论");
    await assert.rejects(
      c.saveStory(member, { videoId: video, body: "越权" }),
      (e) => e.code === "FORBIDDEN",
    );
    const attempts = await Promise.allSettled([
      c.saveStory(owner, { videoId: video, body: "故事A" }),
      c.saveStory(owner, { videoId: video, body: "故事B" }),
    ]);
    assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      attempts.find((x) => x.status === "rejected").reason.code,
      "CONFLICT",
    );
    const story = (await c.stories(video))[0];
    await assert.rejects(
      c.saveStory(owner, { videoId: video, body: "第二条" }),
      (e) => e.code === "CONFLICT",
    );
    await assert.rejects(
      c.add(member, { videoId: video, parentId: story.id, body: "故事回复" }),
      (e) => e.code === "BAD_REQUEST",
    );
    const first = await c.add(member, {
      videoId: video,
      body: "普通评论1",
      isStory: true,
    });
    await c.saveStory(owner, {
      videoId: video,
      id: story.id,
      body: "编辑后的故事",
    });
    assert.equal((await c.stories(video)).length, 1);
    assert.equal((await c.stories(video))[0].id, story.id);
    assert.equal((await c.stories(video))[0].body, "编辑后的故事");
    await assert.rejects(
      c.add(owner, { videoId: video, body: "官方评论" }),
      (e) => e.code === "FORBIDDEN",
    );
    await assert.rejects(
      c.add(owner, { videoId: video, parentId: first.id, body: "官方回复" }),
      (e) => e.code === "FORBIDDEN",
    );
    await sql`update video_comments set created_at=now()-interval '1 minute' where user_id=${member}`;
    const second = await c.add(member, { videoId: video, body: "普通评论2" });
    assert.equal((await c.list({ videoId: video })).items.length, 2);
    assert.equal((await c.stories(video)).length, 1);
    await migrate("005-single-story");
    assert.equal((await c.list({ videoId: video })).items.length, 2);
    assert.equal((await c.stories(video))[0].id, story.id);
    await assert.rejects(
      sql`insert into video_comments(id,video_id,user_id,body,is_story) values(${randomUUID()},${video},${owner},'非法第二故事',true)`,
      (e) => e.code === "23505",
    );
    assert.notEqual(first.id, second.id);
  } finally {
    await sql.end();
    await admin.unsafe(`drop schema ${ns} cascade`);
    await admin.end();
  }
});
