import assert from "node:assert/strict";
import test from "node:test";
import { createCommunity } from "../src/server/community.ts";

test("匿名添加或移除精选在访问数据库前被拒绝", async () => {
  const community = createCommunity(undefined);
  for (const isFeatured of [true, false])
    await assert.rejects(
      community.setFeatured(null, {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        isFeatured,
      }),
      (error) => error.code === "UNAUTHORIZED",
    );
});
