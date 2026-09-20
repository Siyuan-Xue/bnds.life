import assert from "node:assert/strict";
import test from "node:test";

test("原画支持时优先使用，明确不支持或原画失败后选择兼容源，禁止无限重试", async () => {
  const module = await import("../src/lib/playback-source.ts").catch(
    () => ({}),
  );
  assert.equal(typeof module.preferredSource, "function");
  const video = {
    source: "/fallback.mp4",
    nativeSource: {
      url: "/native.mp4",
      contentType: 'video/mp4; codecs="hvc1"',
    },
  };
  assert.equal(
    module.preferredSource(video, () => "probably"),
    "/native.mp4",
  );
  assert.equal(
    module.preferredSource(video, () => "maybe"),
    "/native.mp4",
  );
  assert.equal(
    module.preferredSource(video, () => ""),
    "/fallback.mp4",
  );
  assert.equal(
    module.preferredSource({ source: "/demo.mp4" }, () => "probably"),
    "/demo.mp4",
  );
  assert.equal(module.fallbackSource(video, "/native.mp4"), "/fallback.mp4");
  assert.equal(module.fallbackSource(video, "/fallback.mp4"), undefined);
});
