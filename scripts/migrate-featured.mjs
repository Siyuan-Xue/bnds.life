import postgres from "postgres";
import { readFile } from "node:fs/promises";

// Only the additive featured column; independent of the media advisory lock.
// Fail promptly if a table lock is busy, so a deploy can retry without keeping
// subsequent uploader queries queued behind the ALTER TABLE.
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '2s'`;
    await tx`SET LOCAL statement_timeout = '10s'`;
    await tx.unsafe(
      await readFile(
        new URL("../ops/migrations/006-featured-videos.sql", import.meta.url),
        "utf8",
      ),
    );
  });
  console.log("首页精选字段迁移完成");
} finally {
  await sql.end();
}
