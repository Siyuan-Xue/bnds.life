import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hdrToneMapFilter } from "../scripts/media/color.mjs";
import { prepareMedia, probeMedia, hashFile } from "../scripts/media/files.mjs";

const hlg = {
  color_transfer: "arib-std-b67",
  color_primaries: "bt2020",
  color_space: "bt2020nc",
};
test("只接纳已验证的 HLG 和 Dolby Vision 8.4 基础层", () => {
  assert.equal(hdrToneMapFilter({ color_transfer: "bt709" }), null);
  assert.ok(hdrToneMapFilter(hlg));
  const dovi = {
    side_data_type: "DOVI configuration record",
    dv_profile: 8,
    dv_bl_signal_compatibility_id: 4,
    bl_present_flag: 1,
    el_present_flag: 0,
  };
  assert.ok(hdrToneMapFilter({ ...hlg, side_data_list: [dovi] }));
  assert.throws(
    () =>
      hdrToneMapFilter({
        ...hlg,
        side_data_list: [{ ...dovi, dv_profile: 5 }],
      }),
    /HDR/,
  );
  assert.throws(
    () => hdrToneMapFilter({ ...hlg, color_primaries: "unknown" }),
    /HDR/,
  );
  assert.throws(() => hdrToneMapFilter({ color_transfer: "smpte2084" }), /HDR/);
});

const filters = execFileSync("ffmpeg", ["-hide_banner", "-filters"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
test(
  "HLG 转为真实 SDR 像素及 BT.709 标记，原片保持一致",
  {
    skip:
      !filters.includes("zscale") &&
      "本地 FFmpeg 未带 zscale；生产服务器执行此测试",
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "bnds-hlg-test-"));
    try {
      const file = join(root, "hlg.mkv");
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=160x90:rate=12",
        "-t",
        "0.5",
        "-pix_fmt",
        "yuv420p10le",
        "-c:v",
        "ffv1",
        "-color_primaries",
        "bt2020",
        "-color_trc",
        "arib-std-b67",
        "-colorspace",
        "bt2020nc",
        file,
      ]);
      const before = await hashFile(file);
      const result = await prepareMedia({
        root,
        file,
        id: "00000000-0000-4000-8000-000000000008",
      });
      const playback = result.assets.find((a) => a.kind === "playback");
      const output = join(root, playback.objectKey);
      const { video } = await probeMedia(output);
      assert.equal(playback.processingMethod, "hlg-to-sdr");
      assert.equal(video.codec_name, "h264");
      assert.equal(video.pix_fmt, "yuv420p");
      assert.equal(video.color_transfer, "bt709");
      assert.equal(video.color_primaries, "bt709");
      assert.equal(video.color_space, "bt709");
      assert.equal(await hashFile(file), before);
      assert.equal(
        await hashFile(
          join(
            root,
            result.assets.find((a) => a.kind === "original").objectKey,
          ),
        ),
        before,
      );
      const frame = (path) =>
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-i",
          path,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ]);
      const mapped = frame(output),
        unmapped = frame(file);
      const meanDifference =
        mapped.reduce(
          (sum, value, i) => sum + Math.abs(value - unmapped[i]),
          0,
        ) / mapped.length;
      assert.ok(meanDifference > 5, "必须转换像素，不能仅改色彩标签");
      assert.equal(
        result.assets.find((a) => a.kind === "poster").processingMethod,
        "extracted",
      );
      // A neutral HLG midtone must not be lifted into near-white SDR.
      // The real-phone regression was checked against AVFoundation forceSDR.
      const gray = join(root, "hlg-neutral.mkv");
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=gray:size=160x90:rate=12",
        "-t",
        "0.5",
        "-pix_fmt",
        "yuv420p10le",
        "-c:v",
        "ffv1",
        "-color_primaries",
        "bt2020",
        "-color_trc",
        "arib-std-b67",
        "-colorspace",
        "bt2020nc",
        gray,
      ]);
      const neutral = await prepareMedia({
        root,
        file: gray,
        id: "00000000-0000-4000-8000-000000000010",
      });
      const neutralFrame = frame(
        join(root, neutral.assets.find((a) => a.kind === "playback").objectKey),
      );
      const mean =
        neutralFrame.reduce((sum, value) => sum + value, 0) /
        neutralFrame.length;
      assert.ok(
        mean >= 90 && mean <= 145,
        `HLG neutral midtone lifted too far: ${mean}/255`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
