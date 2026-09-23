"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Video } from "~/lib/videos";
import { api } from "~/trpc/react";
import { isHomeVideo } from "~/lib/video-sections";
import { Icon } from "./icon";
import styles from "./video-management.module.css";

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
      <button
        className="icon-button admin-action"
        aria-label="管理视频"
        title="管理视频"
        onClick={() => setOpen(true)}
      >
        <Icon name="wrench" />
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
  const router = useRouter();
  const utils = api.useUtils();
  const [title, setTitle] = useState(video.title);
  const [date, setDate] = useState(video.recordedAt ?? "");
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isFeatured, setIsFeatured] = useState(video.isFeatured === true);
  const [featuredMessage, setFeaturedMessage] = useState("");
  const update = api.video.update.useMutation();
  const offline = api.video.offline.useMutation();
  const feature = api.video.setFeatured.useMutation();
  const busy =
    offline.isPending || update.isPending || feature.isPending || leaving;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function toggleFeatured() {
    if (busy) return;
    setError("");
    setFeaturedMessage("");
    try {
      const result = await feature.mutateAsync({
        id: video.id,
        isFeatured: !isFeatured,
      });
      setIsFeatured(result.isFeatured);
      await utils.invalidate();
      router.refresh();
      setFeaturedMessage(
        result.isFeatured ? "已加入首页精选" : "已从首页精选移除",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "精选设置失败，请重试。",
      );
    }
  }
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
  async function offlineVideo() {
    if (busy) return;
    setError("");
    try {
      await offline.mutateAsync({ id: video.id });
      setLeaving(true);
      await utils.invalidate();
      router.replace("/");
      router.refresh();
      onClose();
    } catch (cause) {
      setLeaving(false);
      setError(cause instanceof Error ? cause.message : "下线失败，请重试。");
    }
  }
  return (
    <dialog
      className="management-dialog"
      ref={dialog}
      aria-labelledby="management-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="management-header">
        <h2 id="management-title">管理视频</h2>
        <button className="text-button" onClick={onClose} disabled={busy}>
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
      {isHomeVideo(video) && (
        <div className={styles.featured}>
          <div>
            <h3>首页精选</h3>
            <p role="status">
              {featuredMessage ||
                (isFeatured
                  ? "已在首页精选中展示"
                  : "将这个视频展示在首页顶部")}
            </p>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void toggleFeatured()}
          >
            {feature.isPending
              ? "保存中…"
              : isFeatured
                ? "移出精选"
                : "加入精选"}
          </button>
        </div>
      )}
      <div className="management-delete">
        {!confirmOffline ? (
          <button
            className="danger-text"
            disabled={busy}
            onClick={() => setConfirmOffline(true)}
          >
            下线视频
          </button>
        ) : (
          <>
            <h3>下线这个视频？</h3>
            <p>
              下线后不再在网站展示。服务器文件保留 7
              天，到期后由每日定时任务清理。
            </p>
            <div className="management-delete-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setConfirmOffline(false)}
              >
                取消
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void offlineVideo()}
              >
                {offline.isPending || leaving ? "下线中…" : "确认下线"}
              </button>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
