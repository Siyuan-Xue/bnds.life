# 标志透明背景处理记录

- 输入：用户提供的 `grok-image-73a047eb-1b33-4452-b0e7-d46e359fda3e.jpg`，2176×912，RGB JPEG，无 Alpha 通道。
- 工具：内置 image_gen 图像编辑；未调用 API/CLI，也未改写原始文件。
- 输出：`public/brand/logo-transparent.png`，1937×812，RGBA PNG。
- 检查：Alpha 范围0–255，四角完全透明；白色、深色、棋盘格背景实测，负空间透明，灰色暂停符号保留。
- 图像工具的原始预览可能将极低 Alpha 的边缘颜色显示得较鲜艳；实际网页合成已检查，参见 `brand-preview.html`。

## 选定输出的编辑提示词

```text
Use case: background-extraction. Edit target: the attached user-designed bnds life logo. Only remove the solid white background, including all white negative space within and between the shapes, and return an actual RGBA PNG with a fully transparent alpha background, NOT a rendered checkerboard. Preserve the user's logo precisely: the intertwined open diamond and circular loop, exact band thickness, diagonal angles, all rounded corners, the four colored segments, central four-color play triangle and TWO gray vertical rounded pause bars. Keep original geometry, relative positions, original canvas aspect ratio and layout; do not redraw, stylize, add text, add shadows, add outlines, or add/remove any part. Keep the bright red approximately #F22A1A, orange #FF8500, green #73B338, blue #006ECF and gray pause bars #828691. Maintain clean anti-aliased edges without white halos. The only intended change is white background to transparency.
```
