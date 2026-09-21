#!/usr/bin/env node
// Compatibility entrypoint: every invocation is one scheduled cleanup pass.
import postgres from "postgres";
import {
  cleanupCutoff,
  deletionRoot,
  processDeletionJobs,
} from "./media/deletion.mjs";

let sql;
try {
  if (process.argv.slice(2).some((arg) => arg !== "--once"))
    throw new Error(
      "清理脚本只支持 --once；保留天数由 MEDIA_CLEANUP_RETENTION_DAYS 设置",
    );
  const configured = process.env.MEDIA_CLEANUP_RETENTION_DAYS ?? "7";
  if (!/^\d+$/.test(configured))
    throw new Error("MEDIA_CLEANUP_RETENTION_DAYS 必须是非负整数");
  const retentionDays = Number(configured);
  cleanupCutoff(retentionDays);
  if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
  const root = await deletionRoot(process.env.MEDIA_ROOT);
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const result = await processDeletionJobs(sql, root, { retentionDays });
  console.log(JSON.stringify({ retentionDays, ...result }));
  if (result.jobs.some((job) => job.status === "failed") || result.sweepError)
    process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
