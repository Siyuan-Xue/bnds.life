"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "~/server/better-auth/client";
import { api, type RouterOutputs } from "~/trpc/react";

type Entry = RouterOutputs["discussion"]["list"]["items"][number];

export function CommentComposer({
  videoId,
  parentId,
  replyTo,
  demo = false,
  onDone,
  onCancel,
}: {
  videoId: string;
  parentId?: string;
  replyTo?: string;
  demo?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const session = authClient.useSession();
  const viewer = api.discussion.viewer.useQuery(undefined, {
    enabled: Boolean(session.data) && !demo,
  });
  const pathname = usePathname();
  const utils = api.useUtils();
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const add = api.discussion.add.useMutation();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || demo || add.isPending) return;
    setError("");
    try {
      await add.mutateAsync({ videoId, parentId, body: body.trim() });
      setBody("");
      await utils.discussion.invalidate();
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败，请重试。");
    }
  }
  if (session.data && (viewer.isPending || viewer.data?.isOfficial))
    return null;
  if (!demo && !session.data)
    return (
      <p className="comment-login">
        {session.isPending ? (
          "正在载入账户…"
        ) : (
          <>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
              登录
            </Link>
            后{parentId ? "回复" : "发表评论"}
          </>
        )}
      </p>
    );
  return (
    <form className="comment-composer" onSubmit={submit}>
      <label>
        <span className="sr-only">
          {replyTo ? `回复 ${replyTo}` : "发表评论"}
        </span>
        <textarea
          value={body}
          onFocus={() => setTouched(true)}
          onChange={(event) => setBody(event.target.value)}
          placeholder={replyTo ? `回复 ${replyTo}…` : "写下你的回忆…"}
          maxLength={5000}
          rows={2}
          readOnly={demo}
          required
        />
      </label>
      {demo && touched && <p className="muted-note">预览视频暂不支持评论。</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="comment-compose-actions">
        {body.length > 4500 && (
          <span className="muted-note">{body.length}/5000</span>
        )}
        {onCancel && (
          <button type="button" className="text-button" onClick={onCancel}>
            取消
          </button>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={demo || !body.trim() || add.isPending}
        >
          {add.isPending ? "发布中…" : parentId ? "回复" : "发布"}
        </button>
      </div>
    </form>
  );
}

function EntryContent({
  entry,
  onReply,
}: {
  entry: Entry;
  onReply: () => void;
}) {
  const viewer = api.discussion.viewer.useQuery();
  return (
    <>
      <div className="comment-meta">
        <strong>{entry.author.name}</strong>
        {entry.author.isOfficial && (
          <span className="official-badge">官方</span>
        )}
        <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
      </div>
      <p className="comment-text">{entry.body}</p>
      {!viewer.isPending && !viewer.data?.isOfficial && (
        <button className="comment-reply" onClick={onReply}>
          回复
        </button>
      )}
    </>
  );
}

function Replies({
  videoId,
  parentId,
  onReply,
}: {
  videoId: string;
  parentId: string;
  onReply: (name: string) => void;
}) {
  const replies = api.discussion.list.useInfiniteQuery(
    { videoId, parentId },
    { getNextPageParam: (page) => page.nextCursor ?? undefined },
  );
  return (
    <div className="comment-replies">
      {replies.isPending && (
        <p className="muted-note" role="status">
          正在加载回复…
        </p>
      )}
      {replies.isError && (
        <p className="form-error" role="alert">
          回复加载失败。
          <button
            className="text-button"
            onClick={() => void replies.refetch()}
          >
            重试
          </button>
        </p>
      )}
      {replies.data?.pages
        .flatMap((page) => page.items)
        .map((entry) => (
          <article key={entry.id} className="comment-entry">
            <EntryContent
              entry={entry}
              onReply={() => onReply(entry.author.name)}
            />
          </article>
        ))}
      {replies.hasNextPage && (
        <button
          className="text-button"
          disabled={replies.isFetchingNextPage}
          onClick={() => void replies.fetchNextPage()}
        >
          {replies.isFetchingNextPage ? "加载中…" : "更多回复"}
        </button>
      )}
    </div>
  );
}

export function DiscussionEntry({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <article className="comment-thread">
      <EntryContent
        entry={entry}
        onReply={() => setReplyTo(entry.author.name)}
      />
      {(entry.replyCount > 0 || expanded) && (
        <button
          className="text-button replies-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起回复" : `${entry.replyCount} 条回复`}
        </button>
      )}
      {expanded && (
        <Replies
          videoId={entry.videoId}
          parentId={entry.id}
          onReply={setReplyTo}
        />
      )}
      {replyTo !== null && (
        <CommentComposer
          videoId={entry.videoId}
          parentId={entry.id}
          replyTo={replyTo}
          onCancel={() => setReplyTo(null)}
          onDone={() => {
            setExpanded(true);
            setReplyTo(null);
          }}
        />
      )}
    </article>
  );
}

export function Discussion({
  videoId,
  demo = false,
}: {
  videoId: string;
  demo?: boolean;
}) {
  const comments = api.discussion.list.useInfiniteQuery(
    { videoId },
    {
      enabled: !demo,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  );
  return (
    <section className="discussion" aria-label="评论">
      <h3>评论</h3>
      <CommentComposer videoId={videoId} demo={demo} />
      {comments.isPending && !demo && (
        <p className="muted-note" role="status">
          正在加载评论…
        </p>
      )}
      {comments.isError && (
        <p className="form-error" role="alert">
          评论加载失败。
          <button
            className="text-button"
            onClick={() => void comments.refetch()}
          >
            重试
          </button>
        </p>
      )}
      {comments.data?.pages
        .flatMap((page) => page.items)
        .map((entry) => (
          <DiscussionEntry key={entry.id} entry={entry} />
        ))}
      {comments.data &&
        comments.data.pages.every((page) => page.items.length === 0) && (
          <p className="muted-note">还没有评论，来聊聊这段回忆吧。</p>
        )}
      {comments.hasNextPage && (
        <button
          className="text-button"
          disabled={comments.isFetchingNextPage}
          onClick={() => void comments.fetchNextPage()}
        >
          {comments.isFetchingNextPage ? "加载中…" : "加载更多评论"}
        </button>
      )}
    </section>
  );
}
