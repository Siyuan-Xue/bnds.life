#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, statfs } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { initializeRoot } from "./media/files.mjs";
import {
  migrate,
  importVideo,
  setStatus,
  editVideo,
  addNativePlayback,
} from "./media/store.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    file: { type: "string" },
    title: { type: "string" },
    date: { type: "string" },
    "story-file": { type: "string" },
    poster: { type: "string" },
    manifest: { type: "string" },
    root: { type: "string" },
    publish: { type: "boolean", default: false },
    consume: { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});
const [command, id] = positionals;
const root = resolve(values.root ?? process.env.MEDIA_ROOT ?? ".local/media");
if (values.help || !command) {
  console.log(`站长媒体工具（经 SSH 使用，无网页上传接口）
  pnpm media doctor
  pnpm media migrate
  pnpm media import --file /path/video.mp4 [--title 标题] [--date 2021-06-03] [--story-file story.txt] [--poster cover.jpg] [--publish] [--consume]
  pnpm media batch --manifest /path/batch.json [--publish] [--consume]
  pnpm media list
  pnpm media native UUID --file /path/source.mov  使用原片补充无损原画源
  pnpm media native [UUID]  检查已有原画；缺少源文件时明确报错
  pnpm media edit UUID [--title 标题] [--date 日期或空字符串] [--story-file story.txt]
  pnpm media publish UUID
  pnpm media hide UUID
  --root 可覆盖 MEDIA_ROOT。默认仅导入草稿；未知拍摄日期请留空。
  --consume 在成功入库并复核哈希后删除 incoming；服务器不保留原片。重复文件仅在已有播放资源通过完整性校验后删除。`);
  process.exit(0);
}
let sql;
try {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "缺少 DATABASE_URL，请使用 node --env-file=.env 或 pnpm media",
    );
  sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });
  if (command === "doctor") {
    await initializeRoot(root);
    const disk = await statfs(root);
    for (const tool of ["ffmpeg", "ffprobe"])
      console.log(
        execFileSync(tool, ["-version"], { encoding: "utf8" }).split("\n")[0],
      );
    await sql`SELECT 1`;
    const [tables] =
      await sql`SELECT to_regclass('videos') AS videos,to_regclass('video_assets') AS assets`;
    console.log(
      JSON.stringify(
        {
          root,
          freeGiB: Math.floor((disk.bavail * disk.bsize) / 1024 ** 3),
          reserveGiB: 10,
          database: "connected",
          tables,
        },
        null,
        2,
      ),
    );
  } else if (command === "migrate") {
    await migrate(sql);
    console.log("媒体数据库结构已就绪，账户表未改动");
  } else if (command === "list") {
    console.log(
      JSON.stringify(
        await sql`SELECT id,title,recorded_date,status FROM videos ORDER BY created_at DESC`,
        null,
        2,
      ),
    );
  } else if (command === "native") {
    if (values.file && !id) throw new Error("使用 --file 时必须指定视频 UUID");
    const rows = id
      ? [{ id }]
      : await sql`SELECT id FROM videos ORDER BY created_at`;
    for (const row of rows)
      console.log(
        JSON.stringify(
          await addNativePlayback(sql, root, row.id, { file: values.file }),
        ),
      );
  } else if (command === "import" || command === "edit") {
    const story =
      values["story-file"] !== undefined
        ? await readFile(resolve(values["story-file"]), "utf8")
        : undefined;
    const options = {
      root,
      file: values.file,
      title: values.title,
      recordedAt: values.date,
      story,
      poster: values.poster,
      publish: values.publish,
      consume: values.consume,
    };
    if (command === "import" && !values.file) throw new Error("请指定 --file");
    console.log(
      JSON.stringify(
        command === "import"
          ? await importVideo(sql, options)
          : await editVideo(sql, id, options),
        null,
        2,
      ),
    );
  } else if (command === "batch") {
    if (!values.manifest) throw new Error("请指定 --manifest");
    const base = dirname(resolve(values.manifest));
    const items = JSON.parse(await readFile(values.manifest, "utf8"));
    if (!Array.isArray(items) || !items.length)
      throw new Error("清单必须是非空 JSON 数组");
    let failures = 0;
    for (const [index, item] of items.entries()) {
      try {
        if (!item || typeof item.file !== "string")
          throw new Error("条目缺少 file");
        const result = await importVideo(sql, {
          root,
          file: resolve(base, item.file),
          title: item.title,
          recordedAt: item.recordedAt,
          story: item.story,
          poster: item.poster ? resolve(base, item.poster) : undefined,
          publish: values.publish,
          consume: values.consume,
        });
        console.log(JSON.stringify({ index, file: item.file, ...result }));
      } catch (error) {
        if (error.code === "VIDEO_SOURCE_DELETED") {
          console.log(
            JSON.stringify({
              index,
              file: item?.file,
              deleted: true,
              skipped: "deleted-source",
            }),
          );
          continue;
        }
        failures++;
        console.error(
          JSON.stringify({ index, file: item?.file, error: error.message }),
        );
      }
    }
    if (failures) process.exitCode = 1;
  } else if (command === "publish" || command === "hide") {
    console.log(
      JSON.stringify(
        await setStatus(
          sql,
          root,
          id,
          command === "publish" ? "published" : "hidden",
        ),
      ),
    );
  } else throw new Error("未知命令，请运行 pnpm media --help");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
