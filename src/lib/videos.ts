export type Video = {
  id: string;
  title: string;
  author: string;
  duration: number;
  source: string;
  poster: string;
  orientation: "landscape" | "portrait";
  description: string;
};

const titles = [
  "操场上的那个下午",
  "下课铃响起的时候",
  "毕业前的最后一个夏天",
  "晚自习结束，天还没完全黑",
  "教室窗外的四季",
  "走过无数次的那条路",
  "镜头里的运动会",
  "午后，校园的一角",
  "那天大家都笑得很开心",
  "操场边的晚风",
  "一段没有剪辑的日常",
  "青春里的普通一天",
];

const videos: Video[] = titles.map((title, index) => ({
  id: `memory-${String(index + 1).padStart(2, "0")}`,
  title,
  author: "bnds life",
  duration: 20,
  source: `/media/placeholder-${index % 3 === 1 ? "portrait" : "landscape"}.mp4`,
  poster: `/media/poster-${index + 1}.svg`,
  orientation: index % 3 === 1 ? "portrait" : "landscape",
  description:
    "这是一段用于预览浏览和播放效果的占位视频，尚未加入真实校园影像。标题与评论均为示例内容。",
}));

export function listVideos(query = ""): Video[] {
  const normalized = query.trim().toLocaleLowerCase();
  return videos.filter((video) =>
    `${video.title} ${video.author}`.toLocaleLowerCase().includes(normalized),
  );
}

export function findVideo(id: string): Video | undefined {
  return videos.find((video) => video.id === id);
}

export function recommendVideos(startId?: string): Video[] {
  // Stable preview order; this is not a personalized recommendation algorithm.
  const order = [1, 4, 0, 7, 3, 10, 2, 8, 5, 11, 6, 9];
  const result = order
    .map((index) => videos[index])
    .filter((video): video is Video => Boolean(video));
  const start = result.findIndex((video) => video.id === startId);
  return start > 0
    ? [...result.slice(start), ...result.slice(0, start)]
    : result;
}

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
