# 账户与讨论

访客无须登录即可浏览。邮箱密码注册不要求邮件验证，注册昵称 1–40 字，密码 8–128 字。普通账户只拥有评论与回复权限。姓名为 official 的官方账户必须由服务器预先创建，权限来自数据库 is_official，不能通过注册、改昵称或客户端字段获得。

## 数据

- Better Auth 管理 user、account、session；密码仅以框架生成的哈希存储。
- video_comments 保存视频、用户、根评论、正文和时间。回复始终指向同视频的根评论，支持对回复继续回复；普通根评论及回复每页 20 条。
- 官方根评论作为故事，官方回复仍属于讨论。现有 videos.story 作为旧数据兼容显示。
- 视频修改只接受名称和有效拍摄日期（年、年月、年月日或清空）。
- 每个账户发表评论至少间隔 5 秒，数据库行锁防止并发绕过。

## 首次部署

1. 备份数据库，在事务内依次执行 ops/migrations/003-community.sql、004-video-deletion.sql（001/002 已有）。
2. 使用强随机密码，在本机私有文件保存邮箱和密码的 JSON。通过 SSH stdin 传给服务器脚本：`node --env-file=/srv/bnds-life/shared/.env scripts/create-official.mjs`。脚本不输出密码，拒绝覆盖已有邮箱或提升普通账户。
3. 启动 ops/bndslife-media-delete.service，部署网页。详细文件删除规则参见 video-deletion.md。
4. Nginx 必须覆盖 X-Real-IP，应用只监听回环地址；Better Auth 据此按真实客户端 IP 限流。tRPC 的 POST Origin 必须匹配 BETTER_AUTH_URL。

## 验证

`node --env-file=.env --test --test-concurrency=1 tests/community.integration.mjs tests/media-deletion.integration.mjs` 使用随机隔离 schema 和人工文件，结束清理测试数据。`pnpm check` 与 `pnpm test` 检查类型、样式和媒体/布局回归。无需发送邮件、创建上传界面或给 Web 进程开放原片目录。
