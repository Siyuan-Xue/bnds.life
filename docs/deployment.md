# SSH 部署记录

2026-09-20：当前网站通过 [https://xuesiyuan.com.cn](https://xuesiyuan.com.cn) 访问，应用版本为 `c3c884a`。`bnds.life` 正在备案，按用户要求暂时使用已备案的 `xuesiyuan.com.cn`。原 IP 地址 [http://<SERVER_IP>](http://<SERVER_IP>) 保留。源码保存在现有私有仓库 `Siyuan-Xue/bnds.life` 的 `main`。

## 服务器与运行方式

- SSH：`<SSH_USER>@<SERVER_IP>`，Ubuntu 24.04；所有服务器操作通过 SSH 完成。
- Node.js 26.9.0、pnpm 12.4.2，与此次本地验收版本一致。Node 官方二进制已通过官方 SHA256 校验，安装在 `/opt/node-v26.9.0-linux-x64`。
- Nginx 接收公网 HTTP 80 和 HTTPS 443 请求，代理至 `127.0.0.1:3000`；临时域名的 HTTP 请求以 308 跳转至 HTTPS，保留路径和查询参数。
- Next.js 由 `bndslife.service` 管理，以无登录权限的专用用户 `bndslife` 运行；异常退出自动重启，已设置开机自启。
- 生产数据库为 Ubuntu 软件源维护的 PostgreSQL 16.15，数据库／角色均为 `bndslife`，仅监听本机。当前四张账户基础表已初始化；未开放登录，也未导入本地数据。开发数据库仍为 PostgreSQL 18。

## 路径

| 内容             | 服务器路径                                             |
| ---------------- | ------------------------------------------------------ |
| 当前版本链接     | `/srv/bnds-life/current`                               |
| 应用发布目录     | `/srv/bnds-life/releases/c3c884a`                      |
| 独立生产环境配置 | `/srv/bnds-life/shared/.env`                           |
| systemd 服务     | `/etc/systemd/system/bndslife.service`                 |
| Nginx 站点       | `/etc/nginx/sites-available/bndslife`                  |
| HTTPS 证书       | `/etc/letsencrypt/live/xuesiyuan.com.cn/fullchain.pem` |
| HTTP-01 验证目录 | `/var/www/letsencrypt`                                 |
| 续期后重载钩子   | `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx`   |

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

## 临时域名与 HTTPS

用户明确授权操作 DNSPod 后，将 `xuesiyuan.com.cn` 的 `@` A 记录由 `<OLD_SERVER_IP>` 改为 `<SERVER_IP>`，TTL 保持 600 秒；`www` 记录未改动。DNSPod 两台权威服务器及公共 DNS 已验证返回新 IP。切换期间部分递归 DNS 仍会短暂缓存旧地址。

使用 Ubuntu 官方软件源的 Certbot，通过 Nginx webroot 的 HTTP-01 验证签发 Let's Encrypt ECDSA 证书，首次证书到期日为 2026-12-19。仅启用 TLS 1.2／1.3，私钥保留在服务器。生产 `BETTER_AUTH_URL` 已更新为 `https://xuesiyuan.com.cn`，其他生产密钥与权限保持原样。

`certbot.timer` 已启用。续期后由 [重载钩子](../ops/reload-nginx) 先执行 `nginx -t`，再重载 Nginx。完整续期演练（含 deploy hook）已通过：

```sh
sudo certbot renew --cert-name xuesiyuan.com.cn --dry-run --run-deploy-hooks --no-random-sleep-on-renew
systemctl status certbot.timer --no-pager
```

HTTPS 首页、推荐、观看页、图标、目录与空会话 API 均返回 200，证书校验结果为 0；视频 Range 返回 206／1024 字节。新服务器公网 443 可达，HTTP 跳转保留路径及查询参数；原 IP HTTP 仍返回 200。浏览器已确认 HTTPS 月份首页与推荐自动播放正常，视频来源为同域 HTTPS，媒体无错误，推荐页控制台无警告或错误。

重新搭建时，先提供 HTTP-01 目录并签发证书，再安装 [完整 Nginx 配置](../ops/nginx.conf)，避免证书尚不存在时加载 HTTPS 配置。将 `ops/reload-nginx` 以 755 权限安装到上述续期钩子路径。首次切换前的服务器 Nginx 配置备份位于 `<NGINX_CONFIG_BACKUP>`。

等 `bnds.life` 备案完成后，再为其设置解析、签发独立证书并更新 Nginx 与生产 `BETTER_AUTH_URL`。迁移可继续使用现有发布目录和数据库，无需重新导入数据；届时再决定临时域名是否重定向至正式域名。

## 真实媒体准备（2026-09-20）

生产数据库已通过增量迁移新增 videos/video_assets；账户数据保留。新应用已完成构建和隔离验收，目前公开 current 仍为 c3c884a，真实目录等待首批视频验证后启用。媒体目录独立于 release，管理员入口 `/srv/bnds-life/bin/bnds-media`，工具链接 `/srv/bnds-life/media-tools`。

已执行两次数据库备份，最近备份为 `/srv/bnds-life/backups/<BACKUP_ID>`；在独立数据库实际恢复并完成导入、页面、封面、Range 206 和隐藏/404 验收。验收服务与数据库已清理。操作方式见 [媒体说明](media-import.md)。
