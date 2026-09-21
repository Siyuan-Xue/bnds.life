"use client";

import { useState, type FormEvent } from "react";
import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import { Discussion } from "./discussion";
import { Icon } from "./icon";

function StoryContent({ video }: { video: Video }) {
  const demo = video.isDemo === true || video.id.startsWith("memory-");
  const viewer = api.discussion.viewer.useQuery();
  const stories = api.discussion.stories.useQuery(
    { videoId: video.id },
    { enabled: !demo },
  );
  const story = stories.data?.[0];
  const text = story?.body ?? video.story?.trim() ?? "";
  const [editing, setEditing] = useState(false);
  return (
    <>
      {editing && viewer.data?.isOfficial ? (
        <StoryEditor
          key={story?.id ?? video.id}
          videoId={video.id}
          storyId={story?.id}
          body={text}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <p className={text ? "story-text" : "story-empty"}>
            {text || "这段回忆的故事，待续。"}
          </p>
          {viewer.data?.isOfficial && !demo && (
            <button
              className="text-button story-edit-button"
              disabled={stories.isPending || stories.isError}
              onClick={() => setEditing(true)}
            >
              {story ? "编辑故事" : "添加故事"}
            </button>
          )}
        </>
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
    </>
  );
}

function StoryEditor({
  videoId,
  storyId,
  body: initial,
  onDone,
}: {
  videoId: string;
  storyId?: string;
  body: string;
  onDone: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState("");
  const save = api.discussion.saveStory.useMutation();
  const utils = api.useUtils();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending || !body.trim()) return;
    setError("");
    try {
      await save.mutateAsync({ videoId, id: storyId, body: body.trim() });
      await utils.discussion.stories.invalidate({ videoId });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
      await utils.discussion.stories.invalidate({ videoId });
    }
  }
  return (
    <form className="comment-composer story-editor" onSubmit={submit}>
      <label>
        <span className="sr-only">故事正文</span>
        <textarea
          aria-label="故事正文"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={100000}
          rows={5}
          required
          disabled={save.isPending}
          placeholder="写下这段回忆的故事…"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="comment-compose-actions">
        <button
          className="text-button"
          type="button"
          onClick={onDone}
          disabled={save.isPending}
        >
          取消
        </button>
        <button
          className="primary-button"
          disabled={save.isPending || !body.trim()}
        >
          {save.isPending ? "保存中…" : storyId ? "保存修改" : "发布故事"}
        </button>
      </div>
    </form>
  );
}

export function Story({ video }: { video: Video }) {
  return (
    <section className="story story-inline" aria-label="故事">
      <div className="story-header">
        <h2>故事</h2>
      </div>
      <div className="story-body">
        <StoryContent key={video.id} video={video} />
      </div>
    </section>
  );
}

export function StoryPanel({
  video,
  onClose,
}: {
  video: Video;
  onClose: () => void;
}) {
  const demo = video.isDemo === true || video.id.startsWith("memory-");
  return (
    <div className="story story-panel">
      <div className="story-header">
        <h2>故事</h2>
        <button className="icon-button" aria-label="关闭故事" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="story-body" tabIndex={0}>
        <section aria-label="故事">
          <h3>{video.title}</h3>
          <StoryContent key={video.id} video={video} />
        </section>
        <Discussion
          key={`comments-${video.id}`}
          videoId={video.id}
          demo={demo}
        />
      </div>
    </div>
  );
}
