import assert from "node:assert/strict";
import test from "node:test";
import {
  videoAspectRatio,
  recommendationAspectRatio,
  watchColumnAspectRatio,
} from "../src/lib/video-layout.ts";

test("使用媒体原始宽高，未加载或无效元数据不产生错误比例", () => {
  for (const [width, height, expected] of [
    [1920, 1080, 16 / 9],
    [1080, 1920, 9 / 16],
    [1080, 1080, 1],
    [1440, 1080, 4 / 3],
    [1080, 1440, 3 / 4],
    [2560, 1080, 64 / 27],
    [720, 1920, 3 / 8],
    [0, 0, undefined],
    [1920, 0, undefined],
    [-1, 1080, undefined],
    [Infinity, 1080, undefined],
    [1920, NaN, undefined],
  ])
    assert.equal(
      videoAspectRatio(width, height),
      expected,
      `${width}×${height}`,
    );
});

test("推荐页允许中间竖屏比例，横屏最多使用方形框，未知或极窄视频使用竖屏框", () => {
  for (const [ratio, expected] of [
    [9 / 16, 9 / 16],
    [3 / 4, 3 / 4],
    [1, 1],
    [4 / 3, 1],
    [16 / 9, 1],
    [64 / 27, 1],
    [3 / 8, 9 / 16],
    [undefined, 9 / 16],
    [NaN, 9 / 16],
    [0, 9 / 16],
  ])
    assert.equal(recommendationAspectRatio(ratio), expected);
});

test("观看页横屏列宽跟随比例，方形和竖屏保留信息列宽", () => {
  for (const [ratio, expected] of [
    [4 / 3, 4 / 3],
    [16 / 9, 16 / 9],
    [64 / 27, 64 / 27],
    [1, 16 / 9],
    [3 / 4, 16 / 9],
    [9 / 16, 16 / 9],
  ]) {
    assert.equal(watchColumnAspectRatio(ratio), expected);
  }
});

test("电脑故事侧面板恢复 9:16，手机版覆盖弹窗保留媒体适配比例", () => {
  for (const [sourceRatio, normalRatio] of [
    [1, 1],
    [3 / 4, 3 / 4],
    [16 / 9, 1],
  ]) {
    assert.equal(recommendationAspectRatio(sourceRatio, true), 9 / 16);
    assert.equal(recommendationAspectRatio(sourceRatio, false), normalRatio);
  }
});
