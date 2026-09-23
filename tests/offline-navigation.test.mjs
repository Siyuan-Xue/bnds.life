import assert from "node:assert/strict";
import test from "node:test";
import { destinationAfterOffline } from "../src/lib/offline-navigation.ts";

test("长视频下线后回到首页原位置，直接访问时回到对应月份", () => {
  const video = { id: "long", duration: 61, recordedAt: "2023-07-18" };
  assert.equal(destinationAfterOffline(video, undefined, true), "/");
  assert.equal(destinationAfterOffline(video), "/#month-2023-07");
  assert.equal(
    destinationAfterOffline({ ...video, recordedAt: undefined }),
    "/",
  );
});

test("从旧到新浏览后下线长视频，返回时保留排列方式", () => {
  const video = { id: "long", duration: 90, recordedAt: "2023-07-15" };
  assert.equal(destinationAfterOffline(video, undefined, true, "asc"), "/?order=asc");
  assert.equal(
    destinationAfterOffline(video, undefined, false, "asc"),
    "/?order=asc#month-2023-07",
  );
});

test("短拍下线后进入下一条，只有一条时停留在短拍页", () => {
  const video = { id: "short", duration: 60 };
  assert.equal(destinationAfterOffline(video, "next"), "/recommend?v=next");
  assert.equal(destinationAfterOffline(video, "short"), "/recommend");
  assert.equal(destinationAfterOffline(video), "/recommend");
});
