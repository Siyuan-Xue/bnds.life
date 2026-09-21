import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { withMediaLock } from "./media/store.mjs";
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await withMediaLock(sql, async (connection) => {
    await connection`BEGIN`;
    try {
      for (const name of [
        "003-community",
        "004-video-deletion",
        "005-single-story",
        "006-featured-videos",
      ])
        await connection.unsafe(
          await readFile(
            new URL(`../ops/migrations/${name}.sql`, import.meta.url),
            "utf8",
          ),
        );
      await connection`COMMIT`;
    } catch (error) {
      await connection`ROLLBACK`;
      throw error;
    }
  });
  console.log("账户、故事、评论及下线任务迁移完成");
} finally {
  await sql.end();
}
