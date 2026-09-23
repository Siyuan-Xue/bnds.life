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

const published = {
  id: "duration-fixture",
  title: "时长边界",
  story: null,
  recordedDate: null,
  status: "published",
};
const playableAssets = (original, playback) => [
  {
    kind: "original",
    objectKey: "originals/private.mov",
    durationMs: original,
  },
  { kind: "playback", objectKey: "playback/video.mp4", durationMs: playback },
  { kind: "poster", objectKey: "posters/cover.jpg" },
];

test("分类时长保留毫秒，优先使用拍摄文件记录的时长", () => {
  for (const [original, playback, seconds] of [
    [59999, 60020, 59.999],
    [60000, 60020, 60],
    [60001, 59990, 60.001],
  ])
    assert.equal(
      publicVideo(published, playableAssets(original, playback)).duration,
      seconds,
    );
});

test("原片缺少有效时长时回退播放资源，两者都无效则不公开", () => {
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity]) {
    assert.equal(
      publicVideo(published, playableAssets(invalid, 60001)).duration,
      60.001,
    );
    assert.equal(
      publicVideo(published, playableAssets(invalid, invalid)),
      undefined,
    );
  }
});

test("精选只公开已发布的首页视频，隐藏或短拍的精选标记不泄露", () => {
  const featured = { ...published, isFeatured: true };
  assert.equal(
    publicVideo(featured, playableAssets(60001, 60020)).isFeatured,
    true,
  );
  for (const duration of [59999, 60000])
    assert.equal(
      publicVideo(featured, playableAssets(duration, 60020)).isFeatured,
      undefined,
    );
  for (const status of ["draft", "hidden"])
    assert.equal(
      publicVideo({ ...featured, status }, playableAssets(60001, 60020)),
      undefined,
    );
  assert.equal(
    publicVideo(
      { ...published, isFeatured: false },
      playableAssets(60001, 60020),
    ).isFeatured,
    undefined,
  );
});

test("副标题从原文件名提取分钟，重命名标题和管理员修改日期不丢失时间", () => {
  const assets = playableAssets(65000, 65000);
  assets[0].originalFilename = "2023-07-14 155459.mov";
  const video = publicVideo(
    { ...published, title: "暑假的一天", recordedDate: "2023-07-15" },
    assets,
  );
  assert.equal(video.recordedAt, "2023-07-15");
  assert.equal(video.recordedTime, "15:54");
  assert.equal("originalFilename" in video, false);
  assets[0].originalFilename = "2023-07-14 000001.MOV";
  assert.equal(
    publicVideo({ ...published, recordedDate: "2023-07-14" }, assets)
      .recordedTime,
    "00:00",
  );
});

test("没有可靠文件名时间或完整拍摄日期时不生成虚构时间", () => {
  for (const filename of [
    null,
    undefined,
    "video.mov",
    "2023-02-29 155400.mov",
    "2023-07-14 245400.mov",
    "2023-07-14 156000.mov",
    "2023-07-14 155460.mov",
  ]) {
    const assets = playableAssets(65000, 65000);
    assets[0].originalFilename = filename;
    assert.equal(
      publicVideo(
        {
          ...published,
          title: "2023-07-14 155400",
          recordedDate: "2023-07-14",
        },
        assets,
      ).recordedTime,
      undefined,
    );
  }
  for (const date of [null, "2023", "2023-07"]) {
    const assets = playableAssets(65000, 65000);
    assets[0].originalFilename = "2023-07-14 155400.mov";
    assert.equal(
      publicVideo({ ...published, recordedDate: date }, assets).recordedTime,
      undefined,
    );
  }
});

test("下载重名添加的括号后缀不会丢失拍摄时间", () => {
  for (const filename of [
    "2023-07-15 183305(1).mov",
    "2023-07-15 183305(1)(1).mov",
    "2023-07-15 183305 (6).MOV",
  ]) {
    const assets = playableAssets(65000, 65000);
    assets[0].originalFilename = filename;
    assert.equal(
      publicVideo({ ...published, recordedDate: "2023-07-15" }, assets)
        .recordedTime,
      "18:33",
    );
  }
});
