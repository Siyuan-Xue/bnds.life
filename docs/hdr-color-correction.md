# 首批 HLG 视频亮度修正

2026-09-20，用户发现处理后的真实视频过曝。

## 原因

原片为 HEVC 10-bit、BT.2020、HLG，包含 Dolby Vision 8.4 的兼容基础层。原片 SHA256 与本地一致。公开版已经正确标记为 H.264/BT.709，但这只能证明格式正确，不能证明亮度映射正确。

首版使用 `zscale=t=linear:npl=100` 后接 `mobius:param=0.3:desat=2:peak=10`。对本批手机素材，这条曲线将中间亮度抬高，造成皮肤、浅色衣服和墙面发白。播放器没有提亮滤镜；唯一 brightness 样式为封面悬停时的 0.96 倍变暗。问题发生在转码阶段。

## 证据与修正

- 对同一原片的 2 秒、30 秒画面，使用 Apple AVFoundation `AVAssetImageGenerator.dynamicRangePolicy = .forceSDR` 提取系统 SDR 参考；应用原片方向，并由 Core Graphics 转换到 sRGB。
- 保持解码、色域、输出编码及其他参数不变，只将 Mobius 改为 Hable。两处画面对照中，肤色、暗部和亮部均明显接近系统参考。Hable 并不等同于 Dolby Vision 的完整动态显示映射。
- 增加真正经过 FFmpeg 的中性 HLG 灰阶回归测试；旧曲线输出平均 RGB 185.27/255，超出 90–145 检查范围，测试失败；替换曲线后通过。
- 本地 FFmpeg 缺少 zscale，色彩集成测试在服务器执行。本地其他测试及 ESLint/TypeScript 检查通过。

已上线资源从私有完整原片重新生成，视频 ID、标题、日期、故事和原片记录保持不变。播放版和封面改用内容哈希文件名，数据库事务更新两条资源记录，避免 24 小时静态缓存保留旧画面。旧资源暂留供回退，原片不重写。

诊断图片、系统参考提取代码位于本地 `.local/color-debug/`，不提交私人影像到 Git。首次重处理前备份：`/srv/bnds-life/backups/<BACKUP_ID>`；旧资源记录保存在私有 `/srv/bnds-life/<DEBUG_DIR>/previous-assets.json`。

参考：[Apple forceSDR](https://developer.apple.com/documentation/avfoundation/avassetimagegenerator/dynamicrangepolicy-swift.struct/forcesdr)、[FFmpeg tonemap](https://ffmpeg.org/ffmpeg-filters.html#tonemap)。
