import assert from "node:assert/strict";
import test from "node:test";
import * as videoLayout from "../src/lib/video-layout.ts";
import {
  videoAspectRatio,
  recommendationAspectRatio,
  watchColumnAspectRatio,
  watchRecommendationCount,
} from "../src/lib/video-layout.ts";

test("观看页按可用高度展示完整推荐卡片，末张不裁切", () => {
  assert.equal(watchRecommendationCount(792, 140, 8, 77), 6);
  assert.equal(watchRecommendationCount(880, 140, 8, 77), 6);
  assert.equal(watchRecommendationCount(881, 140, 8, 77), 7);
  assert.equal(watchRecommendationCount(1400, 140, 8, 77), 10);
});

test("推荐不足时不重复补齐，空目录不生成卡片", () => {
  assert.equal(watchRecommendationCount(792, 140, 8, 2), 2);
  assert.equal(watchRecommendationCount(792, 140, 8, 0), 0);
});

test("卡片尚未完成布局时保留现有目录", () => {
  assert.equal(watchRecommendationCount(792, 0, 8, 11), 11);
});

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

test("短拍在 9:16 至 16:9 之间使用原始比例，超宽或极窄视频保留黑边", () => {
  for (const [ratio, expected] of [
    [9 / 16, 9 / 16],
    [3 / 4, 3 / 4],
    [1, 1],
    [4 / 3, 4 / 3],
    [16 / 9, 16 / 9],
    [64 / 27, 16 / 9],
    [3 / 8, 9 / 16],
    [9 / 16 + 0.001, 9 / 16 + 0.001],
    [16 / 9 - 0.001, 16 / 9 - 0.001],
  ])
    assert.equal(recommendationAspectRatio(ratio), expected);
});

test("短拍在媒体元数据尚未加载或无效时使用稳定的竖屏框", () => {
  for (const [ratio, expected] of [
    [undefined, 9 / 16],
    [NaN, 9 / 16],
    [0, 9 / 16],
    [-1, 9 / 16],
    [Infinity, 9 / 16],
    [-Infinity, 9 / 16],
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

test("电脑展开故事统一为9:16，关闭后恢复原画幅适配", () => {
  for (const [sourceRatio, normalRatio] of [
    [9 / 16, 9 / 16],
    [1, 1],
    [3 / 4, 3 / 4],
    [4 / 3, 4 / 3],
    [16 / 9, 16 / 9],
    [64 / 27, 16 / 9],
  ]) {
    assert.equal(recommendationAspectRatio(sourceRatio, true), 9 / 16);
    assert.equal(recommendationAspectRatio(sourceRatio, false), normalRatio);
  }
});

test("短拍切换每屏高度时保留当前视频并按新高度重新对齐", () => {
  assert.equal(typeof videoLayout.recommendationResizeScrollTop, "function");
  assert.equal(videoLayout.recommendationResizeScrollTop(2, 688, 788), 1576);
  assert.equal(videoLayout.recommendationResizeScrollTop(2, 788, 688), 1376);
  assert.equal(videoLayout.recommendationResizeScrollTop(0, 688, 788), 0);
});

test("初始测量、宽度改变或无效高度不能中断用户滚动", () => {
  assert.equal(typeof videoLayout.recommendationResizeScrollTop, "function");
  for (const [previousHeight, height] of [
    [undefined, 788],
    [788, 788],
    [688, 0],
    [688, NaN],
    [688, Infinity],
  ]) {
    assert.equal(
      videoLayout.recommendationResizeScrollTop(2, previousHeight, height),
      undefined,
    );
  }
});
