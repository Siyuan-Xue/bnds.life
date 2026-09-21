"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

const statusLabels = {
  pending: "等待删除",
  running: "正在删除",
  failed: "删除未完成",
  complete: "已删除",
} as const;

export function DeletionTasks({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const utils = api.useUtils();
  const jobs = api.video.deletions.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const retry = api.video.remove.useMutation();
  const [retryError, setRetryError] = useState<{
    jobId: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function retryJob(jobId: string, videoId: string) {
    if (retry.isPending) return;
    setRetryError(null);
    try {
      await retry.mutateAsync({ id: videoId });
      await Promise.all([
        utils.video.deletions.invalidate(),
        utils.video.deletion.invalidate({ jobId }),
      ]);
    } catch (cause) {
      setRetryError({
        jobId,
        message:
          cause instanceof Error ? cause.message : "重试失败，请稍后再试。",
      });
    }
  }
  return (
    <dialog
      className="management-dialog deletion-tasks-dialog"
      ref={dialog}
      aria-labelledby="deletion-tasks-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="management-header">
        <h2 id="deletion-tasks-title">删除任务</h2>
        <button className="text-button" onClick={onClose}>
          关闭
        </button>
      </div>
      <p className="muted-note">
        关闭窗口后任务会继续。这里显示进行中、失败的任务及最近完成的任务。
      </p>
      {jobs.isPending && (
        <p className="muted-note" role="status">
          正在加载任务…
        </p>
      )}
      {jobs.isError && (
        <p className="form-error" role="alert">
          任务加载失败。
          <button className="text-button" onClick={() => void jobs.refetch()}>
            重试
          </button>
        </p>
      )}
      {jobs.data?.length === 0 && <p className="muted-note">暂无删除任务。</p>}
      <ul className="deletion-task-list">
        {jobs.data?.map((job) => (
          <li key={job.jobId}>
            <div className="deletion-task-heading">
              <strong>{job.title}</strong>
              <span
                className={`deletion-task-status deletion-task-${job.status}`}
              >
                {statusLabels[job.status]}
              </span>
            </div>
            <time className="muted-note" dateTime={job.createdAt}>
              {new Date(job.createdAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour12: false,
              })}
            </time>
            {job.status === "failed" && (
              <>
                <p className="form-error">
                  {job.error ?? "删除未完成，可重新尝试。"}
                </p>
                <button
                  className="text-button"
                  disabled={retry.isPending}
                  onClick={() => void retryJob(job.jobId, job.videoId)}
                >
                  {retry.isPending && retry.variables?.id === job.videoId
                    ? "正在重试…"
                    : "重试删除"}
                </button>
              </>
            )}
            {retryError?.jobId === job.jobId && (
              <p className="form-error" role="alert">
                {retryError.message}
              </p>
            )}
          </li>
        ))}
      </ul>
    </dialog>
  );
}
