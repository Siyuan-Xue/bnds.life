# SSH 部署记录

2026-09-20：当前网站已部署到 [http://<SERVER_IP>](http://<SERVER_IP>)，应用版本为 `c3c884a`。用户选择本次先使用服务器 IP，域名解析和 HTTPS 暂不配置。源码已推送到现有私有仓库 `Siyuan-Xue/bnds.life` 的 `main`。

## 服务器与运行方式

- SSH：`<SSH_USER>@<SERVER_IP>`，Ubuntu 24.04；所有服务器操作通过 SSH 完成。
- Node.js 26.9.0、pnpm 12.4.2，与此次本地验收版本一致。Node 官方二进制已通过官方 SHA256 校验，安装在 `/opt/node-v26.9.0-linux-x64`。
- Nginx 接收公网 HTTP 80 请求，代理至 `127.0.0.1:3000`。
- Next.js 由 `bndslife.service` 管理，以无登录权限的专用用户 `bndslife` 运行；异常退出自动重启，已设置开机自启。
- 生产数据库为 Ubuntu 软件源维护的 PostgreSQL 16.15，数据库／角色均为 `bndslife`，仅监听本机。当前四张账户基础表已初始化；未开放登录，也未导入本地数据。开发数据库仍为 PostgreSQL 18。

## 路径

| 内容 | 服务器路径 |
| --- | --- |
| 当前版本链接 | `/srv/bnds-life/current` |
| 应用发布目录 | `/srv/bnds-life/releases/c3c884a` |
| 独立生产环境配置 | `/srv/bnds-life/shared/.env` |
| systemd 服务 | `/etc/systemd/system/bndslife.service` |
| Nginx 站点 | `/etc/nginx/sites-available/bndslife` |

生产环境的数据库密码和 Better Auth 密钥在服务器随机生成，不复制本地 `.env`，不写入 Git。配置文件权限为 `640`，所在目录为 `750`；仅部署账户和应用组可读取。项目内的 [systemd 配置](../ops/bndslife.service) 和 [Nginx 配置](../ops/nginx.conf) 不含密钥。

## 部署过程与验证

通过 `git archive` 导出已提交源码，使用 SCP 传输并核对 SHA256；没有上传 `.env`、本地数据库或 macOS 的 `node_modules`。服务器使用 `pnpm install --frozen-lockfile --prod=false --ignore-scripts` 安装 Linux 依赖，完成首次空库 `db:push`、11 项测试及生产构建。

- 公网首页、推荐页、观看页、图标、视频目录 API 和空会话 API 均返回 200。
- 视频 Range 请求返回 206，`bytes=0-1023` 得到正确的 1024 字节，支持拖动播放进度。
- 未知视频返回 404；`/.env` 返回 403。
- 浏览器确认月份首页、推荐自动播放和观看页媒体加载正常；推荐故事框与视频框顶边 y=64、底边 y=688 一致。
- 浏览器错误／警告为空；服务运行正常、检查时 `NRestarts=0`，Nginx、应用、PostgreSQL 均已启用开机自启。

## 后续更新与恢复

继续通过 SSH 操作。每次将已提交版本归档到新的 `releases/<提交号>` 目录，链接现有生产 `.env`，按锁文件安装、测试并构建。先验证构建成功，再原子切换 `current` 链接并重启 `bndslife`；保留上一个发布目录，失败时切回旧链接并重启即可。不要覆盖生产环境配置，不要将本地依赖目录直接上传到 Linux。后续数据库结构变动先检查迁移内容，不能沿用首次空库初始化的假设。

常用检查命令（SSH 登录后）：

```sh
systemctl status bndslife --no-pager
sudo journalctl -u bndslife -n 100 --no-pager
sudo nginx -t
curl -I http://127.0.0.1:3000/
```

后续启用域名时，先将 `bnds.life` 的 A 记录指向服务器，再配置证书与续期，将生产 `BETTER_AUTH_URL` 更新为实际 HTTPS 地址。
