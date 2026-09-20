# 标志透明背景处理记录

## 深色背景版本与网页接入（2026-09-20）

- 用户将产品名更新为 `BNDS.life`，并要求深色背景下双竖线为白色。
- 新素材：`public/brand/logo-dark.png`，1937×812，RGBA；四角透明，两条暂停竖线为白色，中间间隙透明。
- 浅色页头使用原灰色竖线版本；深色素材用于深底展示及浏览器深色图标。`BrandLogo` 通过 SVG viewBox 展示完整图形，去除多余的透明外边距，不改写 PNG。
- 已检查实际网页页头，以及深浅背景预览。320/390/768/1440px 视口无横向溢出或页头按钮重叠。
- 页头、浏览器页面标题、登录提示、示例署名及封面字标统一为 BNDS.life。
- 处理工具：内置 image_gen。深色版本使用以下提示词：

```text
Use case: precise-object-edit. Edit this existing transparent BNDS.life logo. Make exactly ONE change: recolor only the TWO GRAY VERTICAL ROUNDED PAUSE BARS inside the left loop to solid pure WHITE (#FFFFFF), for use on dark backgrounds. Their shape, corner radius, size, location and spacing must remain identical. Preserve the four-color red/orange/green/blue interwoven mark and central play triangle exactly as supplied. Preserve the original canvas aspect ratio, layout, transparent areas, and smooth antialiased edges. Output a genuine transparent RGBA PNG. Every formerly gray pixel in those two bars should become white; the bars must remain visibly opaque, not transparent. Do not recolor any other part. Do not add a dark background, text, shadows, outlines, or new elements. Do not redraw or redesign the logo.
```

## 首次白底去除记录

- 输入：用户提供的 `grok-image-73a047eb-1b33-4452-b0e7-d46e359fda3e.jpg`，2176×912，RGB JPEG，无 Alpha 通道。
- 工具：内置 image_gen 图像编辑；未调用 API/CLI，也未改写原始文件。
- 输出：`public/brand/logo-transparent.png`，1937×812，RGBA PNG。
- 检查：Alpha 范围0–255，四角完全透明；白色、深色、棋盘格背景实测，负空间透明，灰色暂停符号保留。
- 图像工具的原始预览可能将极低 Alpha 的边缘颜色显示得较鲜艳；实际网页合成已检查，参见 `brand-preview.html`。

## 选定输出的编辑提示词

```text
Use case: background-extraction. Edit target: the attached user-designed bnds life logo. Only remove the solid white background, including all white negative space within and between the shapes, and return an actual RGBA PNG with a fully transparent alpha background, NOT a rendered checkerboard. Preserve the user's logo precisely: the intertwined open diamond and circular loop, exact band thickness, diagonal angles, all rounded corners, the four colored segments, central four-color play triangle and TWO gray vertical rounded pause bars. Keep original geometry, relative positions, original canvas aspect ratio and layout; do not redraw, stylize, add text, add shadows, add outlines, or add/remove any part. Keep the bright red approximately #F22A1A, orange #FF8500, green #73B338, blue #006ECF and gray pause bars #828691. Maintain clean anti-aliased edges without white halos. The only intended change is white background to transparency.
```
