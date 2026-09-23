import assert from "node:assert/strict";
import test from "node:test";
import { mediaAssetKey } from "../src/lib/media-access.ts";

test("only a current playback or poster asset path may be checked", () => {
  const id = "00000000-0000-4000-8000-000000000091";
  assert.deepEqual(mediaAssetKey(`/media/playback/${id}/native.mp4`), {
    videoId: id,
    key: `playback/${id}/native.mp4`,
    kind: "playback",
  });
  assert.deepEqual(mediaAssetKey(`/media/posters/${id}/cover.jpg`), {
    videoId: id,
    key: `posters/${id}/cover.jpg`,
    kind: "poster",
  });
  assert.deepEqual(mediaAssetKey(`/media/playback/${id}/native.mp4?t=1`), {
    videoId: id,
    key: `playback/${id}/native.mp4`,
    kind: "playback",
  });
  for (const path of [
    `/media/originals/${id}/source.mov`,
    `/media/playback/${id}/../native.mp4`,
    `/media/playback/${id}/native.mp4/extra`,
    `/media/playback/${id}/native%2emp4`,
    "/media/playback/no-id/native.mp4",
  ]) {
    assert.equal(mediaAssetKey(path), undefined, path);
  }
});
