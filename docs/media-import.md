# 真实视频导入与维护

网站没有上传界面或上传 API。站长通过 SSH 传文件，再运行离线工具；网页只查询已发布的视频。数据库目录更新后，刷新页面即可看到变化，无需构建或重启网站。

## 位置

| 内容                     | 服务器目录                       | 网页可访问     |
| ------------------------ | -------------------------------- | -------------- |
| 上传暂存                 | `/srv/bnds-life/media/incoming`  | 否             |
| 历史原片（新导入不写入） | `/srv/bnds-life/media/originals` | 否             |
| 工作目录                 | `/srv/bnds-life/media/.work`     | 否             |
| 播放文件                 | `/srv/bnds-life/media/playback`  | 是，仅文件读取 |
| 封面                     | `/srv/bnds-life/media/posters`   | 是，仅文件读取 |
| 数据库备份与文件清单     | `/srv/bnds-life/backups`         | 否             |

真实文件不放在 Git、`public/` 或 `releases/`。所有路径均独立于 xuesiyuan.com.cn/bnds.life。草稿和隐藏状态控制目录展示；静态媒体本身没有账户鉴权，知道播放文件完整地址仍可访问。这里不用于保存需要授权观看的内容，私有原片永不映射到网站。

## 上传及导入

本地原片仅暂存。单条传输完成且 SHA256 校验一致后才导入；服务器处理、入库、验收播放资源后删除对应本地输入。

```sh
ssh <SSH_USER>@<SERVER_IP> 'mkdir -p /srv/bnds-life/media/incoming/batch-001'
rsync -rt --partial --progress -e ssh /本地视频目录/ <SSH_USER>@<SERVER_IP>:/srv/bnds-life/media/incoming/batch-001/
# 也可使用 scp -p 上传单个文件；文件系统修改时间不是可信拍摄日期。
```

以下命令在服务器 SSH 会话中运行：

```sh
/srv/bnds-life/bin/bnds-media doctor
/srv/bnds-life/bin/bnds-media import --file /srv/bnds-life/media/incoming/batch-001/video.mp4 --title '那天的操场' --date 2021-06-03 --consume
/srv/bnds-life/bin/bnds-media list
/srv/bnds-life/bin/bnds-media publish <返回的视频UUID>
```

默认导入为草稿。确认本批均应直接展示时，可加 `--publish`。`--story-file /path/story.txt` 可提供故事正文；`--poster /path/cover.jpg` 可提供封面。没有封面会自动从视频截帧，失败时使用灰色占位图并明确提示。拍摄日期支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD`；不知道就不传，不使用上传日期或文件修改时间推断。原始嵌入元数据仅私有保存，可供人工核对拍摄日期。

批量导入使用 [JSON 清单样例](../ops/media-batch.example.json)，放在视频文件旁边，填写实际标题/日期后执行。`file` 和 `poster` 相对清单所在目录；故事为字符串。逐个处理，某个失败会报告并继续其他条目，最终退出码为 1；成功条目保留，重跑以原片 SHA256 去重，不覆盖已修改的标题/故事，也不更改既有发布状态。

```sh
/srv/bnds-life/bin/bnds-media batch --manifest /srv/bnds-life/media/incoming/batch-001/batch.json --publish --consume
```

生产导入始终使用 `--consume`：成功入库并复核输入哈希后删除 incoming。重复文件先验证已入库播放资源的大小及 SHA256，再删除 incoming 副本；失败或输入变化则保留。CLI 不带此参数仍保留输入，方便调试。

服务器不再归档原片。original 行仅保存来源 SHA256、文件名、大小、时长和 ffprobe JSON，object_key 是逻辑路径；所有调用方不得要求原片磁盘文件存在。去重及已删片墓碑完全依赖库字段。

```sh
/srv/bnds-life/bin/bnds-media edit <UUID> --title '新的标题' --date 2021-06 --story-file /path/story.txt
/srv/bnds-life/bin/bnds-media edit <UUID> --date ''
/srv/bnds-life/bin/bnds-media hide <UUID>
/srv/bnds-life/bin/bnds-media publish <UUID>
```

## 媒体处理与空间

兼容 MP4/H.264/yuv420p/AAC、最长边不超过 1920、码率不超过约 8 Mbps、帧率不超过 60 时，先清理公开文件的元数据并做 faststart 重封装；保留重封装输出；若 SHA256 与输入完全一致则标记 reuse，不再建立原片硬链接。此步骤不重新压缩画面；其他素材按需转成 H.264/AAC，最长边至多 1920、CRF 20、2 编码线程，不放大低分辨率素材。HLG/BT.2020（含 Dolby Vision 8.4 的 HLG 基础层）使用线性浮点色调映射转成 SDR/BT.709，仅在支持时保留原画封装，不归档完整原片；其他 HDR/Dolby Vision 规格仍报错，需有代表性素材验证后再支持。

每次导入前要求可用空间大于该原片大小的三倍加 10 GiB 余量；批量串行处理。服务器初次检查约 151 GiB 可用，实际以 doctor 为准。几百个 200 MB 视频，加上待处理副本和播放版本，可能超过容量，应分批传输并按需使用 --consume。容量不足时停止该文件，既有视频继续服务，不自动购买存储或删除旧视频。

文件处理失败会清理本次工作目录，输入文件不删除。进程强制终止可能遗留 `.work`；数据库提交异常可能遗留以 UUID 命名的文件，但不应盲目清理：先核对数据库状态与 SHA256，确认无引用再人工恢复/清理。不存在后台自动监听或自动删除任务。

## 备份及恢复

```sh
/srv/bnds-life/bin/bnds-media backup
```

备份包含 PostgreSQL 自定义格式 dump 和媒体相对路径/大小/SHA256 清单，权限私有；备份不复制所有视频文件，也未设置自动定时执行。批量导入后和修改前执行一次，将备份复制到本地或其他独立设备，；本地也不长期保存母带。同盘备份不防服务器磁盘故障。

恢复时在独立数据库使用 `pg_restore --no-owner --no-acl -d <恢复数据库> database.dump`，核对表/数量后再切换连接；仅恢复 playback/native/poster 文件并核对 SHA256；original 只恢复数据库记录。不要直接对正在使用的数据库执行 `--clean`。

## 数据结构与开发

`videos`：固定 UUID、title、story、recorded_date、status、source_sha256、published_at、created_at、updated_at。`video_assets`：UUID、video_id、kind、object_key、original_filename、mime_type、size_bytes、sha256、width、height、duration_ms、processing_method、metadata、created_at。每段视频保留 original 元数据、playback、poster，以及可选 native。公开 DTO 只包含播放所需字段，原片名和元数据不出现在公开 API。

增量迁移为 `pnpm media migrate`，只新增媒体表和索引，幂等执行，不修改账户表。生产已通过 `VIDEO_CATALOG_MODE=database` 启用真实视频目录。本地默认 demo，原演示目录仅用于开发测试。开发数据库模式的文件同样需要 Nginx 映射媒体目录；本地 Next.js 不提供原片或媒体写接口。

验证命令：`pnpm test`、`pnpm test:media`、`pnpm check`、`pnpm build`。媒体测试依赖 FFmpeg/FFprobe；数据库测试创建随机 media_test_ 前缀 schema，结束后仅清理本次测试 schema 和临时文件。

## 当前素材命名与批次

用户将真实素材下载到项目的 `videos/`（已排除 Git），格式为 `YYYY-MM-DD HHmmss.mov`。仅处理下载完成、大小与修改时间稳定且 FFprobe 可读取的文件；跳过 `.downloading` 等临时文件。日期从文件名的 YYYY-MM-DD 提取；暂用去掉扩展名的原文件名作为标题，保留时分秒，不凭内容编造名称或故事。传输完成比对本地与服务器 SHA256，再导入并发布。

管理员入口为 `/srv/bnds-life/bin/bnds-media`，通过独立的 `media-tools` 链接运行，和网页 `current` 发布链接分开。服务器不再写 originals，本地输入在服务器播放文件验收完成后删除。

HDR 转换依据：[FFmpeg tonemap](https://ffmpeg.org/ffmpeg-filters.html#tonemap)、[Dolby Vision 8.4 的 HLG 基础层](https://professionalsupport.dolby.com/s/article/Transcoding-Dolby-Vision-profile-8-4-to-HLG-on-Android)。使用 BT.709 SDR 播放版，不将其宣称为保留 Dolby Vision 动态显示映射的 HDR 播放。

## 原画优先播放（2026-09-20）

用户已确认切换为原画优先。新导入的 HEVC/H.264 视频（AAC-LC 或无音轨）在需要兼容转码时，同时生成 `native` 资源：只复制音视频比特流到 faststart MP4，保留分辨率、帧率、HDR/Dolby Vision 和旋转信息；音视频流 SHA256 必须与原片一致。原本已满足无损播放条件的 H.264 继续直接使用 remux/reuse，不重复生成原画副本。

原画源放在既有公开 `playback/<UUID>/` 目录，私有 `originals` 不开放。MP4 只含第一视频和音频流，去除相机位置、备注及其他元数据轨道。网页只接收原画 URL 和从解码配置解析出的完整 RFC 6381 编码标识；归档元数据不进入 API。

播放器先用 `canPlayType` 检查该文件编码：支持则优先原画，否则用现有 H.264/SDR 兼容源。原画加载/解码出错时只回退一次，保留播放位置、静音与暂停意图；普通缓冲不触发降级。不会改变观看页和推荐页的布局，也不会强制将 HDR 转为 SDR。最终 HDR 显示仍由浏览器、系统和显示设备决定。

增量迁移 `002-native-playback.sql` 只扩展资源类型约束。旧条目可运行 `/srv/bnds-life/bin/bnds-media native UUID --file /path/source.mov` 补建原画源；提供文件时必须指定 UUID，输入 SHA256 必须匹配来源哈希。缺原片明确报错，禁止使用 native 冒充母带；重复执行跳过已有源，标题、日期、故事、兼容源和发布状态不变。先备份，等待正在进行的导入释放媒体锁，再运行 `migrate` 和 `native`。

原画播放保留原码率，不保证降低网络带宽需求。原画与兼容资源均保留，之后可按实际设备与网络数据决定储存策略。

验收：真实 HEVC/HLG 样片在浏览器以原画 MP4 解码为 1920×1080，方向正确；临时测试页模拟原画 404 后自动转用兼容源并继续播放，模拟编码不支持时直接选择兼容源。测试页和样片不随发布部署。单元测试核对封装前后音视频比特流哈希、HLG 标记、旋转、元数据清理和完整编码字符串，数据库集成测试在独立 schema 内验证迁移幂等和原画补建。

## 原片退役与后续清理

暂停受影响的上传、导入和验收进程，更新 media-tools 与批次验收：original 只验库字段，其他资源继续验证大小、SHA256 和 HTTP Range。备份成功后，运行下述工具在媒体锁内验证全部播放资源并删除已入库 UUID 的 originals。未知目录保留，库记录不删除，incoming/playback/posters 不受影响。

```sh
# 服务器：生成只读验收凭据
node --env-file=/srv/bnds-life/shared/.env /srv/bnds-life/media-tools/scripts/source-retention.mjs > /tmp/source-receipts.json
# 服务器：先 backup，再执行历史原片清理；任何资源校验失败则整批拒绝删除
node --env-file=/srv/bnds-life/shared/.env /srv/bnds-life/media-tools/scripts/source-retention.mjs --execute
# 本机：经 SSH 取回新凭据后，仅删除经校验的已发布来源
python3 scripts/cleanup-local-sources.py --receipts .local/source-receipts.json --directory videos --execute
```

每批验收完成后重新生成凭据再清理本机。凭据有效期 24 小时，本地逐文件重算 SHA256、核对大小及文件稳定性；未完成、失败、变化或下线的视频不自动删除本地输入。不要仅凭 SCP 完成或旧上传记录删文件。

删除母带后，仅有播放文件与元数据；native 只含首路音视频，不能用来还原母带轨道或重做完整原片工作流。HDR 返工、补原画必须重新提供 SHA256 匹配的原片文件。服务器和本机均不承担长期母带归档。

历史 originals 清理后不能把 media-tools 回退到要求原片文件存在的旧版；网页 current 可独立回滚，不影响新版媒体工具。
