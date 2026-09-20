import assert from "node:assert/strict";
import test from "node:test";
import { listVideos, findVideo, recommendVideos } from "../src/lib/videos.ts";

test("搜索按视频标题匹配，不把网站品牌作为上传者匹配", () => {
  assert.equal(listVideos("   操场   ").length, 2);
  assert.equal(listVideos("bnds.LIFE").length, 0);
  assert.equal(listVideos("不存在的内容").length, 0);
});
test("未知视频不误播放第一条", () => {
  assert.equal(findVideo("missing"), undefined);
  assert.equal(findVideo("memory-01")?.title, "操场上的那个下午");
});
test("推荐覆盖完整目录，没有重复，不按横竖屏拆分", () => {
  const home = listVideos().map((v) => v.id);
  const recommended = recommendVideos().map((v) => v.id);
  assert.notDeepEqual(home, recommended);
  assert.equal(new Set(recommended).size, home.length);
  assert.deepEqual([...home].sort(), [...recommended].sort());
  assert.equal(recommendVideos("memory-04")[0]?.id, "memory-04");
  assert.equal(recommendVideos("missing").length, 12);
});
