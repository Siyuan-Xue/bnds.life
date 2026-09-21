import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { withMediaLock } from "./media/store.mjs";
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await withMediaLock(sql, async (connection) => {
    await connection`BEGIN`;
    try {
      for (const name of ["003-community", "004-video-deletion"])
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
  console.log("账户、评论及删除任务迁移完成");
} finally {
  await sql.end();
}
