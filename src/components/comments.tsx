"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { useAccountDialog } from "./shell";

const examples = [
  {
    id: 1,
    name: "示例同学 A",
    text: "那时候觉得再普通不过的日常，现在却想再看一遍。",
    time: "3 天前",
    replies: ["还记得那天放学后的晚霞。", "是啊，时间过得真快。"],
  },
  {
    id: 2,
    name: "示例同学 B",
    text: "好多画面，以为已经忘记了。",
    time: "2 天前",
    replies: ["看到这里又想起了当时的朋友。"],
  },
  {
    id: 3,
    name: "示例同学 C",
    text: "原来我们也曾在同一个镜头里。",
    time: "1 天前",
    replies: [],
  },
];

export function Comments({
  onClose,
  title = "评论",
}: {
  onClose?: () => void;
  title?: string;
}) {
  const [sort, setSort] = useState("top");
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const account = useAccountDialog();
  const rows = sort === "new" ? [...examples].reverse() : examples;
  return (
    <section
      className={`comments ${onClose ? "comments-panel" : "comments-inline"}`}
      aria-label={title}
    >
      <div className="comments-header">
        <h2>
          {title} <span>3</span>
        </h2>
        <div className="comment-sort">
          <button
            className="text-button"
            aria-label="评论排序"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name="sort" />
            <span>{sort === "top" ? "热门评论" : "最新评论"}</span>
          </button>
          {menu && (
            <div className="popover" role="menu">
              <button
                role="menuitemradio"
                aria-checked={sort === "top"}
                onClick={() => {
                  setSort("top");
                  setMenu(false);
                }}
              >
                热门评论
              </button>
              <button
                role="menuitemradio"
                aria-checked={sort === "new"}
                onClick={() => {
                  setSort("new");
                  setMenu(false);
                }}
              >
                最新评论
              </button>
            </div>
          )}
        </div>
        {onClose && (
          <button
            className="icon-button"
            aria-label="关闭评论"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="comments-scroll">
        <p className="sample-note">以下是示例评论</p>
        {rows.map((row) => (
          <article className="comment" key={row.id}>
            <span className="avatar">{row.name.slice(-1)}</span>
            <div className="comment-body">
              <p className="comment-author">
                {row.name} <span>{row.time}</span>
              </p>
              <p>{row.text}</p>
              <button className="reply-button" onClick={account}>
                回复
              </button>
              {row.replies.length > 0 && (
                <>
                  <button
                    className="replies-toggle"
                    aria-expanded={expanded.includes(row.id)}
                    onClick={() =>
                      setExpanded((values) =>
                        values.includes(row.id)
                          ? values.filter((id) => id !== row.id)
                          : [...values, row.id],
                      )
                    }
                  >
                    <Icon
                      name="chevron"
                      style={{
                        transform: expanded.includes(row.id)
                          ? "rotate(180deg)"
                          : undefined,
                      }}
                    />
                    {row.replies.length} 条回复
                  </button>
                  {expanded.includes(row.id) && (
                    <div className="replies">
                      {row.replies.map((text, index) => (
                        <div className="comment" key={text}>
                          <span className="avatar small">十</span>
                          <div>
                            <p className="comment-author">
                              示例同学 {index + 1}
                            </p>
                            <p>{text}</p>
                            <button className="reply-button" onClick={account}>
                              回复
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="comment-compose">
        <span className="avatar small">
          <Icon name="user" />
        </span>
        <button onClick={account}>添加评论…</button>
      </div>
    </section>
  );
}
