import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecordedDate } from "../src/lib/recorded-date.ts";
import { publicVideo, orderRecommendations } from "../src/lib/media-catalog.ts";
import { groupVideosByMonth } from "../src/lib/video-timeline.ts";

test("拍摄日期保留精度并拒绝不存在的日期", () => {
  for (const date of ["2021", "2021-06", "2020-02-29"])
    assert.equal(normalizeRecordedDate(date), date);
  for (const date of ["2021-02-29", "2021-13", "0000", "2021-6-3", "yesterday"])
    assert.equal(normalizeRecordedDate(date), undefined);
  assert.equal(normalizeRecordedDate(null), undefined);
  assert.deepEqual(
    groupVideosByMonth([
      { id: "month", recordedAt: "2021-06" },
      { id: "year", recordedAt: "2021" },
    ]).map((g) => g.month),
    ["2021-06", null],
  );
});

test("公开条目只包含已发布可播放资源且不泄露原片信息", () => {
  const row = {
    id: "abc",
    title: "那年夏天",
    story: null,
    recordedDate: "2021-06",
    status: "published",
    sourceSha256: "secret",
  };
  const assets = [
    {
      kind: "original",
      objectKey: "originals/private.mov",
      metadata: { secret: "gps" },
    },
    { kind: "playback", objectKey: "playback/abc/video.mp4", durationMs: 1250 },
    { kind: "poster", objectKey: "posters/abc/cover.jpg" },
  ];
  assert.deepEqual(publicVideo(row, assets), {
    id: "abc",
    title: "那年夏天",
    duration: 1.25,
    source: "/media/playback/abc/video.mp4",
    poster: "/media/posters/abc/cover.jpg",
    recordedAt: "2021-06",
  });
  assert.equal(publicVideo({ ...row, status: "draft" }, assets), undefined);
  assert.equal(publicVideo({ ...row, status: "hidden" }, assets), undefined);
  assert.equal(publicVideo(row, assets.slice(0, 1)), undefined);
  assert.equal(
    publicVideo(row, [
      { ...assets[1], objectKey: "../originals/private.mov" },
      assets[2],
    ]),
    undefined,
  );
});

test("真实推荐覆盖任意长度目录且保持起始视频", () => {
  const entries = Array.from({ length: 350 }, (_, i) => ({ id: `v-${i}` }));
  const result = orderRecommendations(entries, "v-200");
  assert.equal(result[0].id, "v-200");
  assert.equal(new Set(result.map((v) => v.id)).size, 350);
  assert.notDeepEqual(result, entries);
});
