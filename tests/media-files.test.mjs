import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  prepareMedia as prepareWithMode,
  hashFile,
  requireSpace,
  probeMedia,
  verifyAsset,
} from "../scripts/media/files.mjs";

const prepareMedia = (options) =>
  prepareWithMode({ ...options, transcode: true });

test("真实媒体处理：仅保留原片元数据、自动封面、相同比特流复用与按需转码", async () => {
  const root = await mkdtemp(join(tmpdir(), "bnds-media-test-"));
  try {
    const file = resolve("public/media/placeholder-landscape.mp4");
    const before = await hashFile(file);
    const result = await prepareMedia({
      root,
      id: "00000000-0000-4000-8000-000000000001",
      file,
    });
    const original = result.assets.find((a) => a.kind === "original");
    assert.equal(original.sha256, before);
    assert.equal(original.originalFilename, "placeholder-landscape.mp4");
    assert.ok(original.durationMs > 0);
    assert.ok(original.metadata.streams.length);
    await assert.rejects(
      stat(join(root, "originals", "00000000-0000-4000-8000-000000000001")),
      { code: "ENOENT" },
    );
    await verifyAsset(root, {
      kind: "original",
      object_key: original.objectKey,
      sha256: before,
      original_filename: original.originalFilename,
      duration_ms: original.durationMs,
      size_bytes: original.sizeBytes,
      metadata: original.metadata,
    });
    const playback = result.assets.find((a) => a.kind === "playback");
    const poster = result.assets.find((a) => a.kind === "poster");
    assert.ok(playback.durationMs > 0);
    assert.ok((await stat(join(root, poster.objectKey))).size > 100);
    assert.equal(
      (await probeMedia(join(root, playback.objectKey))).video.codec_name,
      "h264",
    );
    const second = await prepareMedia({
      root,
      id: "00000000-0000-4000-8000-000000000002",
      file: join(root, playback.objectKey),
    });
    assert.equal(
      second.assets.find((a) => a.kind === "playback").processingMethod,
      "reuse",
    );
    assert.equal(
      await hashFile(
        join(root, second.assets.find((a) => a.kind === "playback").objectKey),
      ),
      await hashFile(join(root, playback.objectKey)),
    );
    await assert.rejects(
      stat(join(root, "originals", "00000000-0000-4000-8000-000000000002")),
      { code: "ENOENT" },
    );
    const slow = join(root, "index-at-end.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-i", file, "-c", "copy", slow]);
    const remuxed = await prepareMedia({
      root,
      id: "00000000-0000-4000-8000-000000000005",
      file: slow,
    });
    assert.equal(
      remuxed.assets.find((a) => a.kind === "playback").processingMethod,
      "remux",
    );
    const tagged = join(root, "tagged.mp4");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      file,
      "-c",
      "copy",
      "-metadata",
      "location=+39.9000+116.4000/",
      "-metadata",
      "comment=PRIVATE CAMERA OWNER",
      "-movflags",
      "+faststart",
      tagged,
    ]);
    const sanitized = await prepareMedia({
      root,
      id: "00000000-0000-4000-8000-000000000006",
      file: tagged,
    });
    const publicInfo = await probeMedia(
      join(root, sanitized.assets.find((a) => a.kind === "playback").objectKey),
    );
    assert.equal(publicInfo.metadata.format.tags.comment, undefined);
    assert.equal(publicInfo.metadata.format.tags.location, undefined);
    assert.equal(publicInfo.metadata.format.tags["location-eng"], undefined);
    const avi = join(root, "old camera.avi");
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
      avi,
    ]);
    const third = await prepareMedia({
      root,
      id: "00000000-0000-4000-8000-000000000003",
      file: avi,
    });
    assert.equal(
      third.assets.find((a) => a.kind === "playback").processingMethod,
      "transcode",
    );
    assert.equal(await hashFile(file), before);
    const broken = join(root, "broken.mp4");
    await writeFile(broken, "not a video");
    await assert.rejects(
      prepareMedia({
        root,
        id: "00000000-0000-4000-8000-000000000004",
        file: broken,
      }),
    );
    await assert.rejects(prepareMedia({ root, id: "../escape", file }));
    assert.throws(() => requireSpace(100, 200), /空间/);
    requireSpace(100, 20 * 1024 ** 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
