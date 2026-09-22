import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { prepareMedia, probeMedia } from "../scripts/media/files.mjs";
import { publicVideo } from "../src/lib/media-catalog.ts";
import { preferredSource, fallbackSource } from "../src/lib/playback-source.ts";

test("default import creates one lossless native MP4, metadata and poster only", async () => {
  const root = await mkdtemp(join(tmpdir(), "bnds-native-only-"));
  const id = "00000000-0000-4000-8000-000000000091";
  try {
    const result = await prepareMedia({
      root,
      id,
      file: resolve("public/media/placeholder-landscape.mp4"),
    });
    const playback = result.assets.find((a) => a.kind === "playback");
    assert.equal(playback.processingMethod, "stream-copy");
    assert.equal(playback.objectKey, `playback/${id}/native.mp4`);
    assert.deepEqual(await readdir(join(root, "playback", id)), ["native.mp4"]);
    assert.match(playback.metadata.contentType, /avc1/);
    assert.equal(
      (await probeMedia(join(root, playback.objectKey))).video.codec_name,
      "h264",
    );
    await assert.rejects(stat(join(root, "originals", id)), { code: "ENOENT" });
    const video = publicVideo(
      {
        id,
        title: "Native",
        status: "published",
        story: null,
        recordedDate: "2023-01-01",
      },
      result.assets,
    );
    assert.equal(video.nativeSource.url, video.source);
    assert.equal(
      preferredSource(video, () => ""),
      undefined,
    );
    assert.equal(
      preferredSource(video, () => "probably"),
      video.source,
    );
    assert.equal(fallbackSource(video, video.source), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unsupported source is retained instead of silently transcoding", async () => {
  const root = await mkdtemp(join(tmpdir(), "bnds-native-unsupported-"));
  try {
    const file = join(root, "camera.avi");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=160x90:rate=12",
      "-t",
      "0.5",
      "-c:v",
      "mpeg4",
      file,
    ]);
    await assert.rejects(
      prepareMedia({ root, id: "00000000-0000-4000-8000-000000000092", file }),
      /无法无损封装/,
    );
    assert.ok((await stat(file)).size > 0);
    assert.deepEqual(await readdir(join(root, "playback")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
