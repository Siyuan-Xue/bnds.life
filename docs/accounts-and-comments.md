# 账户与讨论

访客无须登录即可浏览。邮箱密码注册不要求邮件验证，注册昵称 1–40 字，密码 8–128 字。普通账户只拥有评论与回复权限。姓名为 official 的官方账户必须由服务器预先创建，权限来自数据库 is_official，不能通过注册、改昵称或客户端字段获得。

## 数据

- Better Auth 管理 user、account、session；密码仅以框架生成的哈希存储。
- video_comments 保存视频、用户、根评论、正文和时间。回复始终指向同视频的根评论，支持对回复继续回复；普通根评论及回复每页 20 条。
- 每个视频只有一段故事（is_story=true，数据库部分唯一索引约束），由官方账户添加或编辑。普通用户只读故事，不能回复故事；官方账户不能发表评论或回复。故事与评论在前端分区显示。迁移 005 合并历史官方根评论、保留已有回复，并迁移旧 videos.story。
- 视频信息修改只接受名称和有效拍摄日期（年、年月、年月日或清空）。独立的 `video.setFeatured` 接口由服务端验证 official 身份，只能将超过 60 秒的已发布视频加入首页精选。
- 每个账户发表评论至少间隔 5 秒，数据库行锁防止并发绕过。

## 首次部署

1. 备份数据库，在事务内依次执行 ops/migrations/003-community.sql、004-video-deletion.sql、005-single-story.sql（001/002 已有）。
2. 使用强随机密码，在本机私有文件保存邮箱和密码的 JSON。通过 SSH stdin 传给服务器脚本：`node --env-file=/srv/bnds-life/shared/.env scripts/create-official.mjs`。脚本不输出密码，拒绝覆盖已有邮箱或提升普通账户。
3. 停用旧 bndslife-media-delete.service，部署网页并启用 ops/bndslife-media-cleanup.timer。管理员仅能下线视频；文件保留 7 天，每日北京时间 03:00 清理到期资源。管理入口位于视频信息区域。详细规则参见 video-deletion.md。
4. Nginx 必须覆盖 X-Real-IP，应用只监听回环地址；Better Auth 据此按真实客户端 IP 限流。tRPC 的 POST Origin 必须匹配 BETTER_AUTH_URL。

## 验证

`node --env-file=.env --test --test-concurrency=1 tests/community.integration.mjs tests/single-story.integration.mjs tests/media-deletion.integration.mjs` 使用随机隔离 schema 和人工文件，结束清理测试数据。`pnpm check` 与 `pnpm test` 检查类型、样式和媒体/布局回归。无需发送邮件、创建上传界面或给 Web 进程开放原片目录。

## 2026-09-21 调整验收

故事与评论拆分为独立区域；官方只可添加一段故事或编辑原故事，普通用户只读故事并可发表多条评论。管理视频入口移动到视频信息区。删除改为下线，按七天保留期和每日北京时间 03:00 定时清理。

验证包含 27 项服务器单元测试、4 个隔离数据库集成测试、ESLint/TypeScript、生产构建，以及隔离站点官方故事创建/编辑、管理下线确认、电脑侧面板与手机底部抽屉。历史下线任务的墓碑不能提前清理保留期内的上传副本。

## Featured migration (2026-09-21)

`006-featured-videos.sql` adds `is_featured`, default false. After a database backup, run `node --env-file=/srv/bnds-life/shared/.env scripts/migrate-featured.mjs`. It only adds the column, uses a two-second lock timeout and does not acquire the uploader's media advisory lock. The full `migrate-community.mjs` also includes 006. Keep the existing `media-tools` release during active uploads; old imports use the column default.
