#!/usr/bin/env node
import postgres from "postgres";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { sourceReceipts } from "./media/source-retention.mjs";
const { values } = parseArgs({
  options: { execute: { type: "boolean", default: false } },
});
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });
try {
  if (!process.env.MEDIA_ROOT) throw new Error("需要 MEDIA_ROOT");
  const result = await sourceReceipts(
    sql,
    resolve(process.env.MEDIA_ROOT),
    values,
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.rejected.length) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
