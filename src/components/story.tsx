"use client";

import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import { Discussion, DiscussionEntry } from "./discussion";
import { VideoManagement } from "./video-management";
import { Icon } from "./icon";

export function Story({
  video,
  onClose,
}: {
  video: Video;
  onClose?: () => void;
}) {
  const text = video.story?.trim() ?? "";
  const demo = video.isDemo === true || video.id.startsWith("memory-");
  const stories = api.discussion.stories.useQuery(
    { videoId: video.id },
    { enabled: !demo },
  );
  const hasStories = Boolean(stories.data?.length);
  return (
    <section
      className={`story ${onClose ? "story-panel" : "story-inline"}`}
      aria-label="故事与评论"
    >
      <div className="story-header">
        <h2>故事与评论</h2>
        {onClose && (
          <button
            className="icon-button"
            aria-label="关闭故事"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="story-body" tabIndex={onClose ? 0 : undefined}>
        {onClose && <h3>{video.title}</h3>}
        <VideoManagement key={`management-${video.id}`} video={video} />
        <section className="official-stories" aria-label="故事">
          {stories.data?.map((entry) => (
            <DiscussionEntry key={entry.id} entry={entry} />
          ))}
          {!hasStories && (
            <p className={text ? undefined : "story-empty"}>
              {text || "这段回忆的故事，待续。"}
            </p>
          )}
          {stories.isError && (
            <p className="form-error" role="alert">
              故事加载失败。
              <button
                className="text-button"
                onClick={() => void stories.refetch()}
              >
                重试
              </button>
            </p>
          )}
        </section>
        <Discussion
          key={`discussion-${video.id}`}
          videoId={video.id}
          demo={demo}
        />
      </div>
    </section>
  );
}
