import assert from "node:assert/strict";
import test from "node:test";
import { groupVideosByMonth } from "../src/lib/video-timeline.ts";

const video = (id, recordedAt) => ({ id, recordedAt });

test("月份跨年按拍摄时间倒序，同月视频也按拍摄日期倒序", () => {
  const input = [
    video("old", "2020-12-31"),
    video("early", "2021-06-01"),
    video("spring", "2021-04-20"),
    video("late", "2021-06-25"),
  ];
  const groups = groupVideosByMonth(input);
  assert.deepEqual(
    groups.map(({ month, videos }) => [month, videos.map((v) => v.id)]),
    [
      ["2021-06", ["late", "early"]],
      ["2021-04", ["spring"]],
      ["2020-12", ["old"]],
    ],
  );
  assert.deepEqual(
    input.map((v) => v.id),
    ["old", "early", "spring", "late"],
  );
});

test("缺失和无效日期单独放在末尾，不猜测拍摄月份", () => {
  const groups = groupVideosByMonth([
    video("missing"),
    video("impossible", "2021-02-30"),
    video("leap", "2020-02-29"),
    video("bad", "not-a-date"),
  ]);
  assert.deepEqual(
    groups.map(({ month, videos }) => [month, videos.map((v) => v.id)]),
    [
      ["2020-02", ["leap"]],
      [null, ["missing", "impossible", "bad"]],
    ],
  );
});

test("空结果不生成空月份区块，同日视频顺序稳定", () => {
  assert.deepEqual(groupVideosByMonth([]), []);
  assert.deepEqual(
    groupVideosByMonth([
      video("a", "2021-06-01"),
      video("b", "2021-06-01"),
    ])[0].videos.map((v) => v.id),
    ["a", "b"],
  );
});
