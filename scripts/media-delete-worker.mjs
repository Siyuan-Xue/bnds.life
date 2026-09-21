#!/usr/bin/env node
import postgres from "postgres";
import { setTimeout } from "node:timers/promises";
import { deletionRoot, processDeletionJobs } from "./media/deletion.mjs";

const once = process.argv.includes("--once");
let stopping = false;
const controller = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    controller.abort();
  });
let sql;
try {
  if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
  const root = await deletionRoot(process.env.MEDIA_ROOT);
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  let lastSweep = 0;
  do {
    const sweep = Date.now() - lastSweep >= 60000;
    const result = await processDeletionJobs(sql, root, { sweep });
    if (sweep && !result.busy) lastSweep = Date.now();
    if (
      once ||
      result.jobs.length ||
      result.incomingRemoved ||
      result.sweepError
    )
      console.log(JSON.stringify(result));
    if (once) {
      if (
        result.jobs.some((job) => job.status === "failed") ||
        result.sweepError
      )
        process.exitCode = 1;
      break;
    }
    if (!stopping)
      await setTimeout(15000, undefined, { signal: controller.signal }).catch(
        (error) => {
          if (error.name !== "AbortError") throw error;
        },
      );
  } while (!stopping);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
