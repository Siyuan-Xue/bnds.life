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

`.env` 不提交 Git。生产环境应设置独立的数据库连接、足够长的 `BETTER_AUTH_SECRET` 与实际站点的 `BETTER_AUTH_URL`。本地数据库与未来生产数据库互相独立。数据库当前只有 `user`、`session`、`account`、`verification` 四张账户基础表。

## 当前页面

- `/`：视频封面网格，支持搜索；直接访问，无需登录。
- `/watch/[id]`：视频播放器、剧场/全屏/倍速/音量/进度、描述和示例评论。
- `/recommend`：相同视频目录的连续播放；上下滚动、键盘方向键和桌面按钮切换；仅当前项播放。

侧栏只有「首页」与「推荐」。桌面评论侧排，窄屏评论使用底部面板，支持排序和展开回复。视频、标题、评论均为示例，横竖屏使用同一目录；媒体文件由本地 ffmpeg 生成，不含真实人物或校园素材。

登录按钮展示账户功能尚未开放的提示。保留 Better Auth 和账户表，但没有开放密码登录、注册或任何 OAuth 提供商。评论没有发布或数据库存储接口。上传、真实媒体存储、个性化推荐和照片/文本内容留待后续需求确定。

## 检查

```sh
pnpm test
pnpm check
pnpm build
pnpm start
```

单元测试覆盖搜索、视频不存在、两个入口目录一致性、推荐去重及浏览器组合快捷键。界面交互和多尺寸检查记录在 [验收记录](docs/verification.md)。

## 文件入口

- `src/lib/videos.ts`：唯一的占位视频目录及排序、查找函数。
- `src/components/`：外壳、侧栏、播放器、观看页、推荐页和评论组件。
- `src/server/api/routers/video.ts`：公开的 tRPC 目录接口。
- `src/server/db/schema.ts`：Drizzle 账户表。

界面以用户提供截图和本次实际访问的 YouTube 页面为参考；YouTube 的地区/账户实验版本可能不同。本次没有复制 YouTube 品牌、广告、订阅、会员或混剪功能。
