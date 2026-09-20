export function videoAspectRatio(
  width: number,
  height: number,
): number | undefined {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return undefined;
  const ratio = width / height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

export function recommendationAspectRatio(
  ratio: number | undefined,
  commentsOpen: boolean,
): number {
  if (
    commentsOpen ||
    ratio === undefined ||
    !Number.isFinite(ratio) ||
    ratio <= 0
  )
    return 9 / 16;
  return Math.min(1, Math.max(9 / 16, ratio));
}

export function watchColumnAspectRatio(ratio: number): number {
  // Narrow footage grows vertically; keep enough width for the details below it.
  return ratio >= 4 / 3 ? ratio : 16 / 9;
}
