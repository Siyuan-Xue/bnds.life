# 视频下线与定期资源清理

官方账户在网页执行“下线”后，视频立即从公开页面隐藏，服务器媒体文件、视频记录及评论暂时保留。下线事务只保存 `video_deletion_jobs` 待清理标记，`created_at` 是本次下线时间；下线不会创建 `deleted_video_sources` 墓碑，也不会调用文件删除脚本。

每天北京时间凌晨 03:00 执行一次服务器清理。默认仅清理下线已满 **7 × 24 小时**、当前仍为 `hidden` 的待处理视频。实际清理时才保存原片 SHA-256 墓碑，并删除服务器上的历史 `originals/<UUID>`（若仍存在）、`playback/<UUID>`（含原画和历史版本）、`posters/<UUID>`、该 UUID 的 `.work` 残留，以及 `incoming` 内内容哈希相同的普通文件；随后删除视频数据库行，级联删除资源记录和评论。用户电脑上的本地原片不受影响。

## 调度与部署

使用 `ops/bndslife-media-cleanup.service` 和 `ops/bndslife-media-cleanup.timer`。service 是 `Type=oneshot`；timer 使用 `OnCalendar=*-*-* 03:00:00 Asia/Shanghai`，最多随机延迟 30 秒，`Persistent=true` 会在服务器错过执行时间后补跑。

**旧的 `bndslife-media-delete.service` 必须保持停止且禁用。** 它的文件仅为兼容和历史回滚保留，当前流程不使用常驻删除服务。安装新版脚本、迁移和两个新 unit 后，由部署负责人重新加载 systemd，并仅启用新 timer：

```sh
sudo systemctl disable --now bndslife-media-delete.service
sudo systemctl daemon-reload
sudo systemctl enable --now bndslife-media-cleanup.timer
systemctl list-timers bndslife-media-cleanup.timer
journalctl -u bndslife-media-cleanup.service -n 100
```

脚本位于 `/srv/bnds-life/media-tools` 对应的发布目录；`bnds-media migrate` 应用媒体迁移 001、002 和 004，网页账户、评论等其他迁移按网站部署流程单独执行。

服务以拥有媒体目录的 `<SSH_USER>` 用户运行，读取 `/srv/bnds-life/shared/.env`，固定使用 `MEDIA_ROOT=/srv/bnds-life/media`，系统文件只读，只有媒体目录允许写入。网页服务不需要新增原片目录访问权限。

保留期由 `MEDIA_CLEANUP_RETENTION_DAYS` 配置，默认 `7`，只接受非负整数。手工运行同样遵守此默认值，不会自动绕过保留期。`0` 表示在下一次脚本执行时处理所有符合状态要求的下线任务，不代表网页立即删除。

```sh
cd /srv/bnds-life/media-tools
MEDIA_ROOT=/srv/bnds-life/media /usr/local/bin/node --env-file=/srv/bnds-life/shared/.env scripts/media-delete-worker.mjs --once
```

该兼容名称的脚本每次只执行一轮，不再轮询。每次输出保留期、截止时间、已处理任务和错误。与导入、发布、原画补全共用 PostgreSQL advisory lock `1112425555`；有其他媒体操作时跳过本次，任务保持原状态，留待下一次计划执行。

## 清理与恢复安全

候选任务必须关联仍为 `hidden` 的视频。清理先锁定视频行，再锁任务，重新确认状态、保留期与原片哈希；不一致时保留文件并记录失败。只有通过检查才提交墓碑和 `running` 状态。物理删除前再次锁定并检查，且在文件删除及视频行删除期间保持行锁，避免与重新发布竞争。已发布视频即使有旧任务也不处理。

异常退出后，下次计划执行会恢复仍为隐藏状态、哈希一致的 `running` 任务，不要求再次等待保留期。`failed` 任务在符合保留期时自动重试；不存在的文件视为已清理。全部文件处理成功后，视频行删除和任务 `complete` 状态在同一事务中提交。

每次计划执行也根据已经实际开始清理的墓碑处理迟到上传，包含完整的 `.uploading` 文件。仅删除稳定文件句柄计算出的精确匹配哈希，删除前重新检查文件身份、大小和时间；部分上传或不同内容保留。刚下线、尚未到期的视频没有墓碑，因此该扫描不会删除其上传副本。

存储目录不能是符号链接；违规会令任务失败。UUID 目录中的符号链接只删除链接本身。`incoming` 的符号链接不跟随也不删除。文件路径仅由固定存储目录和校验过的 UUID 构成，不信任数据库资源表中的任意路径。

## 导入和备份

仅下线的视频可在保留期内通过管理员工具重新发布；清理脚本会跳过已发布视频。实际资源清理开始后，墓碑阻止同一原片重新导入和重新发布。`import` 返回 `VIDEO_SOURCE_DELETED`，`batch` 将其输出为 `deleted: true, skipped: "deleted-source"`，无需上传协调程序再次重试；本地输入仍保留。

墓碑和完成的清理任务长期保留。恢复旧数据库前必须合并最新墓碑和清理记录，防止旧备份重新激活已经清理的视频。现有备份仅包含数据库和媒体清单，不包含视频文件；历史备份中的文字元数据不会被清理脚本重写。

## 测试

```sh
node --test tests/media-deletion.test.mjs
node --env-file=.env --test tests/media-deletion.integration.mjs
```

测试使用临时文件和随机命名数据库 schema。覆盖精确保留期、近期下线保留、到期隐藏视频清理、已发布视频保留、源哈希不一致拒绝、异常恢复、失败自动重试、级联删除、迟到上传、墓碑防止重新导入及符号链接安全。集成测试需要可连接的 PostgreSQL。
