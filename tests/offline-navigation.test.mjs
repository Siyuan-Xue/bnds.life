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

test("短拍下线后进入下一条，只有一条时停留在短拍页", () => {
  const video = { id: "short", duration: 60 };
  assert.equal(destinationAfterOffline(video, "next"), "/recommend?v=next");
  assert.equal(destinationAfterOffline(video, "short"), "/recommend");
  assert.equal(destinationAfterOffline(video), "/recommend");
});
