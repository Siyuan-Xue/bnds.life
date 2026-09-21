import assert from "node:assert/strict";
import test from "node:test";
import { isShortVideo, isHomeVideo } from "../src/lib/video-sections.ts";

test("60秒整属于短拍，毫秒级边界不按显示时长取整", () => {
  for (const [duration, short, home] of [
    [0.001, true, false],
    [59.999, true, false],
    [60, true, false],
    [60.001, false, true],
    [3600, false, true],
    [0, false, false],
    [-1, false, false],
    [NaN, false, false],
    [Infinity, false, false],
    [-Infinity, false, false],
  ]) {
    assert.equal(isShortVideo({ duration }), short, `${duration} short`);
    assert.equal(isHomeVideo({ duration }), home, `${duration} home`);
  }
});
