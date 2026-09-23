# 真实视频导入与维护

网站没有上传界面。站长通过 SSH 把视频暂存至 `/srv/bnds-life/media/incoming/`，再用 `/srv/bnds-life/bin/bnds-media` 导入。网站只展示已发布视频；下线视频的观看页和媒体直链都不可访问。

## 存储规则

| 内容 | 位置 | 保留规则 |
| --- | --- | --- |
| 上传中的原片 | `media/incoming/` | 成功导入并复核 SHA-256 后自动删除；失败输入由站长核查、处理 |
| 无损播放文件 | `media/playback/<UUID>/native.mp4` | 唯一的视频文件 |
| 自动或指定封面 | `media/posters/<UUID>/` | 随视频保留 |
| 临时工作文件 | `media/.work/` | 正常处理完成后删除 |
| 原片信息 | 数据库 `kind=original` 行 | 仅元数据和 SHA-256，不对应磁盘文件 |

媒体文件不存放在 Git、`public/` 或发布目录。旧的 `media/originals/` 目录不再使用；历史文件已清理。`video_assets.kind=playback` 表示 native 播放文件，`original` 只记录原片文件名、大小、时长、来源 SHA-256 和 ffprobe 信息。`videos.source_sha256` 对在库视频判重；永久删除的视频由 `deleted_video_sources` 判重。只记录哈希，不保留用于重新编码的母带。

## 导入

上传前确认文件传输完成，并核对本地和服务器文件的 SHA-256。文件名中的日期和时间用于拍摄时间；不要以文件修改时间代替。

```sh
scp /本地/2023-07-01\ 120000.mov <SSH_USER>@<SERVER_IP>:/srv/bnds-life/media/incoming/
ssh <SSH_USER>@<SERVER_IP>
/srv/bnds-life/bin/bnds-media import --file '/srv/bnds-life/media/incoming/2023-07-01 120000.mov' --date 2023-07-01 --publish
```

`--title` 可覆盖文件名标题，`--story-file` 可提供故事，`--poster` 可指定封面；否则自动截取封面，提取失败时使用占位图。默认导入为草稿，`--publish` 直接发布。`--date` 接受真实的 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD`；不确定时留空。通过 `batch --manifest /path/batch.json --publish` 可串行批量导入，清单格式见 [样例](../ops/media-batch.example.json)。

导入只做音视频流复制、去除公开文件中的相机私有元数据、MP4 faststart 封装和封面提取；不做 H.264 重新编码或 HDR 色调映射。当前可接纳 H.264/HEVC，音频为 AAC-LC 或无音频。无法无损封装时不发布，输入仍在 incoming 等待核查；清理此类输入前应确认其没有任何其他副本及对应已发布资源。

成功导入后，对 incoming 内的输入自动复核 SHA-256 并删除。重复来源只有在已有播放文件和封面通过大小及完整哈希验证后，才删除 incoming 副本。输入在工作过程中变化则停止，避免发布不完整文件。仅保存播放文件、封面和数据库元数据。本机 `videos/` 是暂存目录，本机清理须使用服务器最新的资源核验凭据重新验证哈希。

媒体处理只复制约一份输出，因此可用空间须大于输入文件大小的 1.25 倍加 10 GiB 余量。空间不足时停止本条导入，不动已发布视频。

## 管理、清理与恢复

```sh
/srv/bnds-life/bin/bnds-media edit <UUID> --title '新标题' --date 2023-07-01
/srv/bnds-life/bin/bnds-media hide <UUID>
/srv/bnds-life/bin/bnds-media publish <UUID>
/srv/bnds-life/bin/bnds-media backup
```

下线立即停止目录展示及媒体直链访问，保留文件七天；每日 03:00 的任务清理到期文件。清理时保留来源 SHA-256 墓碑，避免同一原片再次导入。失败导入没有产生视频记录，需要单独核对及清理 incoming。

备份包括数据库 dump 和资源清单，不含视频文件。恢复必须另外提供并校验 native 播放文件和封面；`original` 行是逻辑元数据，无原片可用于返工。需要重新处理时，必须重新取得与数据库来源 SHA-256 一致的原文件。

开发和验证：`pnpm test`、`pnpm test:media`（隔离数据库）、`pnpm check`、`pnpm build`。生产媒体文件由 Nginx 读取，访问前向应用核验文件属于已发布视频且仍是当前数据库资源。
