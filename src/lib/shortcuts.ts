export function isPlaybackShortcut(
  event: Pick<
    KeyboardEvent,
    "ctrlKey" | "metaKey" | "altKey" | "defaultPrevented"
  >,
): boolean {
  return (
    !event.ctrlKey && !event.metaKey && !event.altKey && !event.defaultPrevented
  );
}
