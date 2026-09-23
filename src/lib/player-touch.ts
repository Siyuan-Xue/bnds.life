type Side = "left" | "right" | "center";
export type VideoTap = { side: Side; at: number };

export function interpretVideoTap(
  previous: VideoTap | null,
  relativeX: number,
  at: number,
): { action: "controls" | "back" | "forward"; nextTap: VideoTap | null } {
  const side: Side =
    relativeX < 1 / 3 ? "left" : relativeX > 2 / 3 ? "right" : "center";
  if (
    side !== "center" &&
    previous?.side === side &&
    at > previous.at &&
    at - previous.at <= 320
  ) {
    return { action: side === "left" ? "back" : "forward", nextTap: null };
  }
  return {
    action: "controls",
    nextTap: side === "center" ? null : { side, at },
  };
}
