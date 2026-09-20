import type { Video } from "~/lib/videos";
import { Icon } from "./icon";

export function Story({
  video,
  onClose,
}: {
  video: Video;
  onClose?: () => void;
}) {
  const text = video.story?.trim() ?? "";
  const hasStory = text.length > 0;
  return (
    <section
      className={`story ${onClose ? "story-panel" : "story-inline"}`}
      aria-label="故事"
    >
      <div className="story-header">
        <h2>故事</h2>
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
        <p className={hasStory ? undefined : "story-empty"}>
          {hasStory ? text : "这段回忆的故事，待续。"}
        </p>
      </div>
    </section>
  );
}
