/** A date supplied by the owner. Never infer a shooting date from upload/mtime. */
export function normalizeRecordedDate(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{3}(?:-\d{2}(?:-\d{2})?)?$/.test(value)
  )
    return undefined;
  if (value.length === 4) return value;
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return undefined;
  if (value.length === 7) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

/** Filename clocks are local shooting times, not UTC timestamps. */
export function recordedTimeFromFilename(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match =
    /^(\d{4}-\d{2}-\d{2})[ _](\d{2})(\d{2})(\d{2})(?:\s*\(\d+\))*(?:\.[a-z0-9]+)?$/i.exec(
      value,
    );
  if (!match || !normalizeRecordedDate(match[1])) return undefined;
  const [, , hour, minute, second] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59)
    return undefined;
  return `${hour}:${minute}`;
}
