"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";

const statusLabels = {
  pending: "已下线，待清理",
  running: "正在清理",
  failed: "清理失败，稍后自动重试",
  complete: "资源已清理",
} as const;

export function OfflineVideos({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const videos = api.video.offlineVideos.useQuery(undefined, {
    refetchInterval: 5000,
  });
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="management-dialog deletion-tasks-dialog"
      ref={dialog}
      aria-labelledby="offline-videos-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="management-header">
        <h2 id="offline-videos-title">下线视频</h2>
        <button className="text-button" onClick={onClose}>
          关闭
        </button>
      </div>
      <p className="muted-note">
        下线视频不再在网站展示。服务器文件保留 7 天，到期后由每日北京时间 03:00
        的定时任务清理。
      </p>
      {videos.isPending && (
        <p className="muted-note" role="status">
          正在加载下线视频…
        </p>
      )}
      {videos.isError && (
        <p className="form-error" role="alert">
          下线视频加载失败，稍后自动刷新。
        </p>
      )}
      {videos.data?.length === 0 && (
        <p className="muted-note">暂无下线视频。</p>
      )}
      <ul className="deletion-task-list">
        {videos.data?.map((video) => (
          <li key={video.jobId}>
            <div className="deletion-task-heading">
              <strong>{video.title}</strong>
              <span
                className={`deletion-task-status deletion-task-${video.status}`}
              >
                {statusLabels[video.status]}
              </span>
            </div>
            <p className="muted-note">
              下线日期：
              <time dateTime={video.createdAt}>
                {new Date(video.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour12: false,
                })}
              </time>
            </p>
            {video.status === "failed" && video.error && (
              <p className="form-error">{video.error}</p>
            )}
          </li>
        ))}
      </ul>
    </dialog>
  );
}
