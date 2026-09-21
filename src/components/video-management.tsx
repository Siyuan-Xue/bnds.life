"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";

export function VideoManagement({ video }: { video: Video }) {
  const viewer = api.discussion.viewer.useQuery();
  const [open, setOpen] = useState(false);
  if (
    !viewer.data?.isOfficial ||
    video.isDemo ||
    video.id.startsWith("memory-")
  )
    return null;
  return (
    <div className="video-management">
      <button className="text-button" onClick={() => setOpen(true)}>
        管理视频
      </button>
      {open && (
        <ManagementDialog video={video} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function ManagementDialog({
  video,
  onClose,
}: {
  video: Video;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const completed = useRef(false);
  const router = useRouter();
  const utils = api.useUtils();
  const [title, setTitle] = useState(video.title);
  const [date, setDate] = useState(video.recordedAt ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const update = api.video.update.useMutation();
  const remove = api.video.remove.useMutation();
  const deletion = api.video.deletion.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: Boolean(jobId),
      refetchInterval: (query) =>
        query.state.data?.status === "complete" ||
        query.state.data?.status === "failed"
          ? false
          : 1000,
    },
  );
  const deleting =
    remove.isPending ||
    Boolean(
      jobId &&
      deletion.data?.status !== "failed" &&
      deletion.data?.status !== "complete",
    );
  const submitting = remove.isPending || update.isPending;
  const busy = deleting || update.isPending;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (deletion.data?.status !== "complete" || completed.current) return;
    completed.current = true;
    void utils.invalidate().then(() => {
      router.replace("/");
      router.refresh();
      onClose();
    });
  }, [deletion.data?.status, utils, router, onClose]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSaved(false);
    try {
      await update.mutateAsync({
        id: video.id,
        title: title.trim(),
        recordedAt: date || null,
      });
      await utils.invalidate();
      router.refresh();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    }
  }
  async function deleteVideo() {
    if (busy) return;
    setError("");
    try {
      const job = await remove.mutateAsync({ id: video.id });
      setJobId(job.jobId);
      await utils.video.deletion.invalidate({ jobId: job.jobId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请重试。");
    }
  }
  return (
    <dialog
      className="management-dialog"
      ref={dialog}
      aria-labelledby="management-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
    >
      <div className="management-header">
        <h2 id="management-title">管理视频</h2>
        <button className="text-button" onClick={onClose} disabled={submitting}>
          关闭
        </button>
      </div>
      <form className="auth-form" onSubmit={save}>
        <label>
          视频名称
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
            required
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label>
          拍摄日期
          <input
            type="text"
            placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
            pattern="[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?"
            maxLength={10}
            title="填写年份、年月或完整日期，例如 2021、2021-06、2021-06-25；也可留空"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSaved(false);
            }}
            disabled={busy}
          />
        </label>
        <div className="management-save">
          <span role="status">{saved ? "已保存" : ""}</span>
          <button
            className="primary-button"
            type="submit"
            disabled={busy || !title.trim()}
          >
            {update.isPending ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
      <div className="management-delete">
        {!confirmDelete ? (
          <button
            className="danger-text"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            删除视频
          </button>
        ) : (
          <>
            <h3>永久删除这个视频？</h3>
            <p>
              视频记录、评论，以及服务器上的视频文件、转码文件和封面将被永久删除。此操作无法撤销。
            </p>
            <div className="management-delete-actions">
              <button
                className="text-button"
                disabled={submitting}
                onClick={() => {
                  if (jobId) onClose();
                  else setConfirmDelete(false);
                }}
              >
                {jobId ? "关闭" : "取消"}
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void deleteVideo()}
              >
                {deleting
                  ? "正在删除…"
                  : deletion.data?.status === "failed"
                    ? "重试删除"
                    : "永久删除"}
              </button>
            </div>
          </>
        )}
      </div>
      {deleting && (
        <p className="muted-note" role="status">
          服务器正在后台删除文件。可以关闭此窗口，稍后在账户菜单的“删除任务”中查看进度。
        </p>
      )}
      {deletion.isError && (
        <p className="form-error" role="alert">
          暂时无法获取删除进度，正在重试。
        </p>
      )}
      {(error || deletion.data?.status === "failed") && (
        <p className="form-error" role="alert">
          {error ? error : (deletion.data?.error ?? "删除未完成，请重试。")}
        </p>
      )}
    </dialog>
  );
}
