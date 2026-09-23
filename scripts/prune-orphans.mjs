#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { withMediaLock } from "./media/store.mjs";
import { pruneUnreferenced } from "./media/prune-orphans.mjs";

const { values } = parseArgs({
  options: { execute: { type: "boolean", default: false } },
});
const root = resolve(process.env.MEDIA_ROOT ?? "/srv/bnds-life/media");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const result = await withMediaLock(sql, async (conn) => {
    const rows =
      await conn`SELECT object_key FROM video_assets WHERE kind IN ('playback','poster')`;
    return pruneUnreferenced(root, new Set(rows.map((row) => row.object_key)), {
      execute: values.execute,
    });
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
} finally {
  await sql.end();
}
