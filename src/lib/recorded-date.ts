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
