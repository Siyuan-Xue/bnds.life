"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";
import { DeletionTasks } from "./deletion-tasks";

export function AccountMenu() {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tasksOpen, setTasksOpen] = useState(false);
  const viewer = api.discussion.viewer.useQuery(undefined, {
    enabled: Boolean(session),
  });
  if (isPending)
    return <span className="account-loading" aria-label="正在载入账户" />;
  if (!session)
    return (
      <Link
        className="login-pill"
        href={`/login?next=${encodeURIComponent(pathname)}`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="9"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6 18c.7-3 2.7-4.5 6-4.5s5.3 1.5 6 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        登录
      </Link>
    );
  return (
    <>
      <details className="account-menu">
        <summary aria-label={`账户：${session.user.name}`}>
          <span>{session.user.name.slice(0, 1)}</span>
        </summary>
        <div className="account-popover">
          <strong>{session.user.name}</strong>
          <p>{session.user.email}</p>
          {viewer.data?.isOfficial && (
            <button
              className="account-task-button"
              onClick={() => setTasksOpen(true)}
            >
              删除任务
            </button>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await authClient.signOut();
                if (result.error) {
                  setError("退出失败，请重试。");
                  return;
                }
                await utils.invalidate();
                router.refresh();
              } catch {
                setError("退出失败，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在退出…" : "退出登录"}
          </button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
      </details>
      {tasksOpen && viewer.data?.isOfficial && (
        <DeletionTasks onClose={() => setTasksOpen(false)} />
      )}
    </>
  );
}
