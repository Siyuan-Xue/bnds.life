/** One shuffled feed per request; explicit video links still open at their video. */
export function orderRecommendations<T extends { id: string }>(
  videos: T[],
  startId?: string,
  random: () => number = Math.random,
): T[] {
  const shuffled = [...videos];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  const start = shuffled.findIndex((video) => video.id === startId);
  return start > 0
    ? [...shuffled.slice(start), ...shuffled.slice(0, start)]
    : shuffled;
}
