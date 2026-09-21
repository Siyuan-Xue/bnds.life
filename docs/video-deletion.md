# 永久删除视频

官方账户发起删除后，网页立即隐藏视频，并在同一数据库事务中保存删除任务和原片 SHA-256 墓碑。后台服务删除服务器上的 `originals/<UUID>`、`playback/<UUID>`（含原画和历史版本）、`posters/<UUID>`、该 UUID 的 `.work` 残留，以及 `incoming` 内内容哈希相同的所有普通文件，然后删除视频数据库行，级联删除资源记录和评论。用户电脑上的本地原片不会删除。

## 部署

将新版本的 `scripts/`、`ops/migrations/004-video-deletion.sql` 和依赖部署到 `/srv/bnds-life/media-tools` 对应的版本目录。运行现有 `bnds-media migrate`；该命令仅应用媒体迁移 001、002 和 004，网页账户及评论迁移 003 需按网站部署步骤单独执行。

将 `ops/bndslife-media-delete.service` 安装到 systemd 并启用。服务以拥有媒体目录的 `ubuntu` 用户运行，读取 `/srv/bnds-life/shared/.env` 的数据库配置，显式使用 `MEDIA_ROOT=/srv/bnds-life/media`，系统文件只读，只有媒体目录允许写入。网页服务的 `bndslife` 用户不需要新增原片目录权限。

单次处理和日志诊断：

```sh
cd /srv/bnds-life/media-tools
MEDIA_ROOT=/srv/bnds-life/media /usr/local/bin/node --env-file=/srv/bnds-life/shared/.env scripts/media-delete-worker.mjs --once
journalctl -u bndslife-media-delete.service -n 100
```

工作进程每 15 秒检查任务，与导入、发布、原画补全共用 PostgreSQL advisory lock `1112425555`。忙时稍后重试，不将任务标记为失败。进程异常退出后，下一次会重跑 `running` 任务；文件已不存在是正常情况。删除全部文件后，视频行删除和任务 `complete` 状态在同一事务中提交。文件权限、异常目录等导致失败时保留隐藏的视频和 `failed` 任务，修复后可在网页重试。

`incoming` 每分钟另做一次墓碑清理，覆盖删除任务完成后才传完的上传副本，包括内容已完整的 `.uploading`。只删除稳定文件句柄计算出的精确匹配哈希，重新检查文件身份、大小和时间后才 unlink。内容不同或传输尚未完成的文件保留；未变化且不匹配的文件使用有界哈希缓存，避免重复读取大视频。服务停止时不会执行这项清理，应保持服务启用。

存储目录不能是符号链接；违规会令删除任务失败。UUID 目录中的符号链接只删除链接本身。`incoming` 的符号链接不跟随也不删除，避免触及本地或其他目录。删除时不信任资源表提供的路径，只使用固定存储目录和校验过的 UUID。

## 导入和恢复

`import` 遇到墓碑哈希会以 `VIDEO_SOURCE_DELETED` 拒绝导入，同时尽力清理服务器 incoming 中相同原片的副本。本地输入保留。`batch` 把此情况输出为 `deleted: true, skipped: "deleted-source"`，视为无需重试的终止结果。批量上传协调程序也应把墓碑源视为已处理，不能要求它重新变为 published。CLI 发布和原画补全同样拒绝已申请永久删除的视频。

墓碑和删除任务是永久记录。数据库备份与恢复必须保留最新的 `deleted_video_sources` 和 `video_deletion_jobs`；恢复旧数据库前应合并最新墓碑，并隐藏/清除命中墓碑的视频，禁止直接用旧备份覆盖这些记录。现有备份仅包含数据库和媒体清单，不包含视频文件；旧数据库备份中的文字元数据不会被这个文件删除进程重写。

## 验证

```sh
node --test tests/media-deletion.test.mjs
node --env-file=.env --test tests/media-deletion.integration.mjs
```

单元测试只创建临时文件，覆盖历史版本、临时工作文件、嵌套和迟到上传、完整/不完整 `.uploading`、幂等删除及符号链接安全。集成测试仅创建随机命名的临时数据库 schema 和合成文件，覆盖迁移幂等、锁竞争、`running` 恢复、级联删除、失败后重试和墓碑防止重新导入；需要可连接的 PostgreSQL。
