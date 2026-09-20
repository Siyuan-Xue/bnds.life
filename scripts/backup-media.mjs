#!/usr/bin/env node
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

let sql;
try {
  if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
  const base = resolve(process.env.BACKUP_ROOT ?? ".local/backups");
  await mkdir(base, { recursive: true, mode: 0o700 });
  const destination = join(
    base,
    new Date().toISOString().replaceAll(":", "-") + `-${process.pid}`,
  );
  await mkdir(destination, { mode: 0o700 });
  const url = new URL(process.env.DATABASE_URL);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
  if (url.searchParams.has("sslmode"))
    env.PGSSLMODE = url.searchParams.get("sslmode");
  execFileSync(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      join(destination, "database.dump"),
    ],
    { env, stdio: ["ignore", "ignore", "pipe"] },
  );
  await chmod(join(destination, "database.dump"), 0o600);
  execFileSync("pg_restore", ["--list", join(destination, "database.dump")], {
    stdio: "ignore",
  });
  sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const [exists] = await sql`SELECT to_regclass('video_assets') AS assets`;
  const assets = exists.assets
    ? await sql`SELECT video_id,kind,object_key,size_bytes,sha256 FROM video_assets ORDER BY video_id,kind`
    : [];
  await writeFile(
    join(destination, "media-manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        mediaRoot: process.env.MEDIA_ROOT ?? null,
        assets,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `备份已创建并检查可读：${destination}（数据库与媒体清单；视频文件仍需独立备份）`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
