# 真实视频导入与维护

网站没有上传界面、上传 API 或后台登录。站长通过 SSH 传文件，再运行离线工具；网页只查询已发布的视频。数据库目录更新后，刷新页面即可看到变化，无需构建或重启网站。

## 位置

| 内容                 | 服务器目录                       | 网页可访问     |
| -------------------- | -------------------------------- | -------------- |
| 上传暂存             | `/srv/bnds-life/media/incoming`  | 否             |
| 完整原片             | `/srv/bnds-life/media/originals` | 否             |
| 工作目录             | `/srv/bnds-life/media/.work`     | 否             |
| 播放文件             | `/srv/bnds-life/media/playback`  | 是，仅文件读取 |
| 封面                 | `/srv/bnds-life/media/posters`   | 是，仅文件读取 |
| 数据库备份与文件清单 | `/srv/bnds-life/backups`         | 否             |

真实文件不放在 Git、`public/` 或 `releases/`。所有路径均独立于 xuesiyuan.com.cn/bnds.life。草稿和隐藏状态控制目录展示；静态媒体本身没有账户鉴权，知道播放文件完整地址仍可访问。这里不用于保存需要授权观看的内容，私有原片永不映射到网站。

## 上传及导入

本地保留原片。先按批次上传到新目录，传完后再导入，不在传输过程中启动导入。

```sh
ssh <SSH_USER>@<SERVER_IP> 'mkdir -p /srv/bnds-life/media/incoming/batch-001'
rsync -rt --partial --progress -e ssh /本地视频目录/ <SSH_USER>@<SERVER_IP>:/srv/bnds-life/media/incoming/batch-001/
# 也可使用 scp -p 上传单个文件；文件系统修改时间不是可信拍摄日期。
```

以下命令在服务器 SSH 会话中运行：

```sh
cd /srv/bnds-life/current
pnpm media doctor
pnpm media import --file /srv/bnds-life/media/incoming/batch-001/video.mp4 --title '那天的操场' --date 2021-06-03
pnpm media list
pnpm media publish <返回的视频UUID>
```

默认导入为草稿。确认本批均应直接展示时，可加 `--publish`。`--story-file /path/story.txt` 可提供故事正文；`--poster /path/cover.jpg` 可提供封面。没有封面会自动从视频截帧，失败时使用灰色占位图并明确提示。拍摄日期支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD`；不知道就不传，不使用上传日期或文件修改时间推断。原始嵌入元数据仅私有保存，可供人工核对拍摄日期。

批量导入使用 [JSON 清单样例](../ops/media-batch.example.json)，放在视频文件旁边，填写实际标题/日期后执行。`file` 和 `poster` 相对清单所在目录；故事为字符串。逐个处理，某个失败会报告并继续其他条目，最终退出码为 1；成功条目保留，重跑以原片 SHA256 去重，不覆盖已修改的标题/故事，也不更改既有发布状态。

```sh
pnpm media batch --manifest /srv/bnds-life/media/incoming/batch-001/batch.json --publish
```

默认保留 incoming 文件。确认本地有原片时，可加 `--consume`：只有新文件成功处理、入库且再次核对原片哈希后，才删除 incoming 中的上传副本；originals 中的完整原片始终保留。重复文件不会自动清理。相同原片需要改标题/日期/故事时使用 edit，不重复导入。

```sh
pnpm media edit <UUID> --title '新的标题' --date 2021-06 --story-file /path/story.txt
pnpm media edit <UUID> --date ''
pnpm media hide <UUID>
pnpm media publish <UUID>
```

## 媒体处理与空间

兼容 MP4/H.264/yuv420p/AAC、最长边不超过 1920、码率不超过约 8 Mbps、帧率不超过 60 时，先清理公开文件的元数据并做 faststart 重封装；只有重封装后的 SHA256 与原片完全一致，才使用硬链接复用磁盘数据。此步骤不重新压缩画面；其他素材按需转成 H.264/AAC，最长边至多 1920、CRF 20、2 编码线程，不放大低分辨率素材。HDR/Dolby Vision 暂时明确报错，等看到真实素材后单独确认色彩处理，不能直接压成错误颜色。

每次导入前要求可用空间大于该原片大小的三倍加 10 GiB 余量；批量串行处理。服务器初次检查约 151 GiB 可用，实际以 doctor 为准。几百个 200 MB 视频，加上待处理副本和播放版本，可能超过容量，应分批传输并按需使用 --consume。容量不足时停止该文件，既有视频继续服务，不自动购买存储或删除旧视频。

文件处理失败会清理本次工作目录，输入文件不删除。进程强制终止可能遗留 `.work`；数据库提交异常可能遗留以 UUID 命名的文件，但不应盲目清理：先核对数据库状态与 SHA256，确认无引用再人工恢复/清理。不存在后台自动监听或自动删除任务。

## 备份及恢复

```sh
cd /srv/bnds-life/current
pnpm media:backup
```

备份包含 PostgreSQL 自定义格式 dump 和媒体相对路径/大小/SHA256 清单，权限私有；备份不复制所有视频文件，也未设置自动定时执行。批量导入后和修改前执行一次，将备份复制到本地或其他独立设备，并保留本地原片。同盘备份不防服务器磁盘故障。

恢复时在独立数据库使用 `pg_restore --no-owner --no-acl -d <恢复数据库> database.dump`，核对表/数量后再切换连接；文件按 manifest 的 object_key 恢复到 MEDIA_ROOT，并逐个核对 SHA256。不要直接对正在使用的数据库执行 `--clean`。

## 数据结构与开发

`videos`：固定 UUID、title、story、recorded_date、status、source_sha256、published_at、created_at、updated_at。`video_assets`：UUID、video_id、kind、object_key、original_filename、mime_type、size_bytes、sha256、width、height、duration_ms、processing_method、metadata、created_at。每段视频三类资源各一条。公开 DTO 只包含播放所需字段，原片名和元数据不出现在公开 API。

增量迁移为 `pnpm media migrate`，只新增媒体表和索引，幂等执行，不修改账户表。当前生产接入采用 `VIDEO_CATALOG_MODE=database`；本地默认 demo，原演示目录仅用于开发测试。开发数据库模式的文件同样需要 Nginx 映射媒体目录；本地 Next.js 不提供原片或媒体写接口。

验证命令：`pnpm test`、`pnpm test:media`、`pnpm check`、`pnpm build`。媒体测试依赖 FFmpeg/FFprobe；数据库测试创建随机 media_test_ 前缀 schema，结束后仅清理本次测试 schema 和临时文件。
