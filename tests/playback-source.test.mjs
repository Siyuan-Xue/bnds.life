import assert from "node:assert/strict";
import test from "node:test";
import { preferredSource } from "../src/lib/playback-source.ts";

test("only native is used; unsupported codecs are unavailable", () => {
  const video = {
    source: "/media/playback/id/native.mp4",
    contentType: 'video/mp4; codecs="hvc1"',
  };
  assert.equal(preferredSource(video, () => "probably"), video.source);
  assert.equal(preferredSource(video, () => ""), undefined);
  assert.equal(preferredSource({ source: "/demo.mp4" }, () => ""), "/demo.mp4");
});
