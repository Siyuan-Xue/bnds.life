import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname, join, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export function requireSpace(size, available) {
  if (available < size * 3 + 10 * 1024 ** 3)
    throw new Error("磁盘空间不足：需预留处理空间及 10 GiB 余量");
}
export async function initializeRoot(root) {
  await mkdir(root, { recursive: true, mode: 0o755 });
  for (const [name, mode] of [
    ["incoming", 0o700],
    ["originals", 0o700],
    [".work", 0o700],
    ["playback", 0o755],
    ["posters", 0o755],
  ]) {
    const path = join(root, name);
    await mkdir(path, { recursive: true, mode });
    if ((await lstat(path)).isSymbolicLink())
      throw new Error(`媒体目录不能是符号链接：${name}`);
    await chmod(path, mode);
  }
}
export async function probeMedia(file) {
  const { stdout } = await execute(
    "ffprobe",
    ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
    { maxBuffer: 4 * 1024 ** 2, timeout: 60000 },
  );
  const metadata = JSON.parse(stdout);
  const video = metadata.streams?.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  const audio = metadata.streams?.find((s) => s.codec_type === "audio");
  const duration = Number(metadata.format?.duration ?? video?.duration);
  if (
    !video ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !(video.width > 0 && video.height > 0)
  )
    throw new Error("无法读取有效的视频画面或时长");
  return { metadata, video, audio, duration };
}
const fallbackPoster =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ededed"/><path d="M590 285L715 360L590 435Z" fill="#888"/></svg>';
async function ffmpeg(args) {
  await execute(
    "ffmpeg",
    [
      "-hide_banner",
      "-v",
      "error",
      "-nostdin",
      "-n",
      "-threads",
      "2",
      "-filter_threads",
      "1",
      ...args,
    ],
    { maxBuffer: 1024 ** 2, timeout: 2 * 60 * 60 * 1000 },
  );
}

export async function prepareMedia({ file, root, id, poster }) {
  if (!uuidPattern.test(id)) throw new Error("无效的视频 ID");
  root = resolve(root);
  file = resolve(file);
  await initializeRoot(root);
  if (!(await lstat(file)).isFile())
    throw new Error("只接受普通视频文件，不接受目录或符号链接");
  const input = await stat(file);
  const fs = await statfs(root);
  requireSpace(input.size, fs.bavail * fs.bsize);
  for (const kind of ["originals", "playback", "posters"]) {
    try {
      await access(join(root, kind, id));
      throw new Error("视频目录已经存在，拒绝覆盖");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const work = await mkdtemp(join(root, ".work", `${id}-`));
  const installed = [];
  try {
    for (const kind of ["originals", "playback", "posters"])
      await mkdir(join(work, kind), {
        mode: kind === "originals" ? 0o700 : 0o755,
      });
    const extension = /^\.[a-zA-Z0-9]{1,8}$/.test(extname(file))
      ? extname(file).toLowerCase()
      : ".bin";
    const original = join(work, "originals", `source${extension}`);
    await copyFile(file, original);
    const sourceSha256 = await hashFile(original);
    if (sourceSha256 !== (await hashFile(file)))
      throw new Error("上传文件仍在变化，请等待传输完成后重试");
    const info = await probeMedia(original);
    const v = info.video;
    if (
      ["smpte2084", "arib-std-b67"].includes(v.color_transfer) ||
      v.side_data_list?.some((d) => /DOVI/i.test(d.side_data_type ?? ""))
    )
      throw new Error(
        "检测到 HDR/Dolby Vision，需确认色彩转换后单独处理；原文件未修改",
      );
    const rotation = Number(
      v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
        v.tags?.rotate ??
        0,
    );
    const [n, d] = String(v.avg_frame_rate ?? "0/1")
      .split("/")
      .map(Number);
    const fps = d ? n / d : 0;
    const bitrate =
      Number(info.metadata.format?.bit_rate) ||
      (input.size * 8) / info.duration;
    const compatible =
      v.codec_name === "h264" &&
      v.pix_fmt === "yuv420p" &&
      (!info.audio || info.audio.codec_name === "aac") &&
      Math.max(v.width, v.height) <= 1920 &&
      bitrate <= 8_000_000 &&
      fps <= 60 &&
      rotation === 0 &&
      [undefined, "1:1", "N/A"].includes(v.sample_aspect_ratio);
    const playback = join(work, "playback", "video.mp4");
    let method;
    {
      const common = [
        "-i",
        original,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
      ];
      if (compatible) {
        await ffmpeg([
          ...common,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          playback,
        ]);
        method = "remux";
        // Reuse only after sanitization has proven the complete bytes unchanged.
        if ((await hashFile(playback)) === sourceSha256) {
          await rm(playback);
          await link(original, playback);
          method = "reuse";
        }
      } else {
        const scale =
          "scale=w='trunc(iw*sar/2)*2':h=ih,setsar=1,scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";
        await ffmpeg([
          ...common,
          "-vf",
          scale + (fps > 60 ? ",fps=60" : ""),
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "20",
          "-maxrate",
          "8M",
          "-bufsize",
          "16M",
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "2",
          "-c:a",
          "aac",
          "-b:a",
          "160k",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          playback,
        ]);
        method = "transcode";
      }
    }
    const played = await probeMedia(playback);
    let cover = join(work, "posters", "cover.jpg");
    let coverMethod = poster ? "custom" : "extracted";
    const warnings = [];
    try {
      if (poster)
        await ffmpeg([
          "-i",
          resolve(poster),
          "-vf",
          "scale=1280:720:force_original_aspect_ratio=decrease",
          "-frames:v",
          "1",
          "-update",
          "1",
          cover,
        ]);
      else
        await ffmpeg([
          "-ss",
          String(Math.min(3, played.duration / 3)),
          "-i",
          playback,
          "-vf",
          "thumbnail=30,scale=1280:720:force_original_aspect_ratio=decrease",
          "-frames:v",
          "1",
          "-update",
          "1",
          cover,
        ]);
      if (!(await stat(cover)).size) throw new Error("封面为空");
    } catch (error) {
      if (poster) throw new Error("指定的封面无法读取", { cause: error });
      await rm(cover, { force: true });
      cover = join(work, "posters", "cover.svg");
      await writeFile(cover, fallbackPoster);
      coverMethod = "fallback";
      warnings.push(
        "自动封面提取失败，已使用占位图；请记录该视频 ID，后续单独处理封面",
      );
    }
    const assets = [];
    for (const [kind, path, mime, processingMethod, probe] of [
      [
        "original",
        original,
        extension === ".mp4" ? "video/mp4" : "application/octet-stream",
        "original",
        info,
      ],
      ["playback", playback, "video/mp4", method, played],
      [
        "poster",
        cover,
        cover.endsWith("svg") ? "image/svg+xml" : "image/jpeg",
        coverMethod,
        null,
      ],
    ]) {
      await chmod(path, 0o644);
      const folder =
        kind === "original"
          ? "originals"
          : kind === "poster"
            ? "posters"
            : "playback";
      assets.push({
        kind,
        objectKey: `${folder}/${id}/${basename(path)}`,
        originalFilename: kind === "original" ? basename(file) : null,
        mimeType: mime,
        sizeBytes: (await stat(path)).size,
        sha256: await hashFile(path),
        width: probe?.video.width ?? null,
        height: probe?.video.height ?? null,
        durationMs: probe ? Math.round(probe.duration * 1000) : null,
        processingMethod,
        metadata: kind === "original" ? info.metadata : null,
      });
    }
    for (const folder of ["originals", "playback", "posters"]) {
      const destination = join(root, folder, id);
      await rename(join(work, folder), destination);
      installed.push(destination);
    }
    return { sourceSha256, assets, warnings };
  } catch (error) {
    for (const path of installed)
      await rm(path, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function verifyAsset(root, asset) {
  if (
    !/^(originals|playback|posters)\/[0-9a-f-]+\/[a-zA-Z0-9_.-]+$/.test(
      asset.object_key,
    )
  )
    throw new Error("非法媒体路径");
  const full = resolve(root, asset.object_key);
  const resolved = await realpath(full);
  if (!resolved.startsWith((await realpath(root)) + sep))
    throw new Error("媒体路径越界");
  if ((await stat(full)).size !== Number(asset.size_bytes))
    throw new Error(`媒体缺失或大小不匹配：${asset.kind}`);
}
