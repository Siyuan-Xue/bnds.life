# BNDS.life · 十一小日子

公开浏览校园影像的中文网站。基于现有 Create T3 App 项目，保留 Next.js App Router、TypeScript、Tailwind CSS、tRPC、Better Auth、Drizzle 和 PostgreSQL。

## 本地运行

先启动 OrbStack 或其他 Docker 运行环境。在项目目录中执行：

```sh
pnpm install
cp .env.example .env # 仅首次克隆时执行，不要覆盖现有 .env
# 生成 BETTER_AUTH_SECRET：openssl rand -base64 32，然后将结果填入 .env
./start-database.sh
pnpm db:push
pnpm dev
```

访问 http://localhost:3000 。本次验收使用 Node.js 26.9.0、pnpm 12.4.2、PostgreSQL 18.6。

`start-database.sh` 负责启动本地 PostgreSQL；初次使用默认密码时会提示生成随机密码并更新 `.env`。重复运行会复用现有容器。`db:push` 同步表结构，不负责启动数据库。

`.env` 不提交 Git。生产环境应设置独立的数据库连接、足够长的 `BETTER_AUTH_SECRET` 与实际站点的 `BETTER_AUTH_URL`。本地数据库与生产数据库互相独立。数据库包含四张账户基础表，以及 `videos`、`video_assets` 媒体目录表。

## 当前页面

- `/`：视频封面网格，支持搜索；直接访问，无需登录。
- `/watch/[id]`：视频播放器、全屏/音量/进度、同一行的标题与日期、只读故事。
- `/recommend`：相同视频目录的连续播放；上下滚动、键盘方向键和桌面按钮切换；仅当前项播放。

侧栏只有「首页」与「推荐」。首页按拍摄月份倒序展示；推荐页电脑故事侧排并与视频等高，手机版故事贴底居中覆盖。公共导航与推荐页共用宽高比 1:1 分界。开发默认演示目录，示例素材不含真实人物或校园内容；生产数据库目录已准备好，首批真实视频验证后启用；空目录显示空状态，不回填演示素材。

页面不提供登录入口、上传者头像、评论或上传功能。保留 Better Auth 和账户表，但没有开放密码登录、注册或任何 OAuth 提供商。故事是只读正文。真实视频由站长通过 SSH/SCP/rsync 传入服务器，再由离线工具提取封面、按需处理播放文件并入库，见 [媒体导入说明](docs/media-import.md)。

## 检查

```sh
pnpm test
pnpm test:media # 需要 FFmpeg/FFprobe 和本地 PostgreSQL；创建临时测试 schema
pnpm check
pnpm build
pnpm start
```

单元测试覆盖搜索、视频不存在、两个入口目录一致性、推荐去重及浏览器组合快捷键。界面交互和多尺寸检查记录在 [验收记录](docs/verification.md)。

## 文件入口

- `src/lib/videos.ts`：公共 Video 类型与开发用演示目录。
- `src/server/videos.ts`：正式只读视频目录，三个页面共用。
- `scripts/media.mjs`：仅通过命令行调用的媒体导入与维护工具。
- `src/components/`：外壳、侧栏、播放器、观看页、推荐页和故事组件。
- `src/server/api/routers/video.ts`：公开的 tRPC 目录接口。
- `src/server/db/schema.ts`：Drizzle 账户表与媒体目录表。

界面以用户提供截图和本次实际访问的 YouTube 页面为参考；YouTube 的地区/账户实验版本可能不同。本次没有复制 YouTube 品牌、广告、订阅、会员或混剪功能。

## 服务器部署

当前访问地址为 [https://xuesiyuan.com.cn](https://xuesiyuan.com.cn)，使用 Nginx、systemd 与独立生产数据库，HTTPS 证书自动续期。此域名按用户要求临时使用，待 `bnds.life` 备案完成后迁移。运行版本、服务路径和更新／恢复方式见 [部署记录](docs/deployment.md)。
