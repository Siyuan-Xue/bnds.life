import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as files from "../scripts/media/files.mjs";
import { publicVideo } from "../src/lib/media-catalog.ts";
import { mp4VideoCodec } from "../scripts/media/codec.mjs";

test("HEVC 兼容位反序并按文件实际级别产生浏览器可识别的编码标识", () => {
  assert.equal(
    mp4VideoCodec("hevc", Buffer.from("010220000000b000000000007b", "hex")),
    "hvc1.2.4.L123.B0",
  );
  assert.equal(
    mp4VideoCodec("h264", Buffer.from("01640028", "hex")),
    "avc1.640028",
  );
  assert.throws(() => mp4VideoCodec("hevc", Buffer.from("00", "hex")));
});

test("原画无损封装保留 HEVC、HLG、旋转和音视频比特流，去除位置标签", async () => {
  assert.equal(typeof files.createNativePlayback, "function");
  const root = await mkdtemp(join(tmpdir(), "bnds-native-"));
  try {
    const plain = join(root, "plain.mp4"),
      file = join(root, "camera.mov"),
      output = join(root, "native.mp4");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=160x90:rate=12",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440",
      "-t",
      "0.5",
      "-c:v",
      "libx265",
      "-x265-params",
      "pools=1:frame-threads=1:log-level=error:colorprim=9:transfer=18:colormatrix=9",
      "-pix_fmt",
      "yuv420p10le",
      "-color_primaries",
      "bt2020",
      "-color_trc",
      "arib-std-b67",
      "-colorspace",
      "bt2020nc",
      "-c:a",
      "aac",
      plain,
    ]);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-display_rotation",
      "180",
      "-i",
      plain,
      "-c",
      "copy",
      "-metadata",
      "location=+39.9000+116.4000/",
      "-metadata",
      "comment=PRIVATE OWNER",
      file,
    ]);
    const before = await files.hashFile(file);
    const asset = await files.createNativePlayback({ file, output });
    const info = await files.probeMedia(output);
    assert.equal(info.video.codec_name, "hevc");
    assert.equal(info.video.codec_tag_string, "hvc1");
    assert.equal(info.video.color_transfer, "arib-std-b67");
    assert.equal(
      Math.abs(
        info.video.side_data_list.find((s) => s.rotation !== undefined)
          .rotation,
      ),
      180,
    );
    assert.equal(info.metadata.format.tags.location, undefined);
    assert.equal(info.metadata.format.tags.comment, undefined);
    const packets = (path) =>
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          path,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0",
          "-c",
          "copy",
          "-f",
          "streamhash",
          "-hash",
          "sha256",
          "-",
        ],
        { encoding: "utf8" },
      );
    assert.equal(packets(output), packets(file));
    assert.equal(await files.hashFile(file), before);
    assert.match(
      asset.contentType,
      /hvc1\.2\.[0-9A-F]+\.[LH][0-9]+\.[0-9A-F]+/,
    );
    assert.equal(
      (await files.createNativePlayback({
        file: plain,
        output: join(root, "again.mp4"),
      })) !== null,
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("公开目录带原画源与兼容源，但不公开归档原片或相机元数据", () => {
  const row = {
    id: "abc",
    title: "视频",
    status: "published",
    story: null,
    recordedDate: null,
  };
  const assets = [
    { kind: "playback", objectKey: "playback/abc/video.mp4", durationMs: 1000 },
    { kind: "poster", objectKey: "posters/abc/cover.jpg" },
    {
      kind: "native",
      objectKey: "playback/abc/native.mp4",
      metadata: { contentType: 'video/mp4; codecs="hvc1"', gps: "secret" },
    },
  ];
  assert.deepEqual(publicVideo(row, assets).nativeSource, {
    url: "/media/playback/abc/native.mp4",
    contentType: 'video/mp4; codecs="hvc1"',
  });
  assert.equal(
    publicVideo(row, assets).source,
    "/media/playback/abc/video.mp4",
  );
  assert.equal(
    publicVideo(row, [
      ...assets.slice(0, 2),
      { ...assets[2], objectKey: "originals/abc/source.mov" },
    ]).nativeSource,
    undefined,
  );
});
