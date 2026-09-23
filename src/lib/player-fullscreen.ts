type PlayerContainer = {
  requestFullscreen?: () => Promise<void> | void;
};

export type NativeFullscreenVideo = {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type FullscreenPage = {
  fullscreenEnabled?: boolean;
  fullscreenElement?: object | null;
  exitFullscreen?: () => Promise<void> | void;
};

export async function togglePlayerFullscreen(
  container: PlayerContainer,
  video: NativeFullscreenVideo,
  page: FullscreenPage,
): Promise<"entered" | "exited" | "unavailable"> {
  if (page.fullscreenElement) {
    if (!page.exitFullscreen) return "unavailable";
    try {
      await page.exitFullscreen();
      return "exited";
    } catch {
      return "unavailable";
    }
  }
  if (video.webkitDisplayingFullscreen) {
    if (!video.webkitExitFullscreen) return "unavailable";
    try {
      video.webkitExitFullscreen();
      return "exited";
    } catch {
      return "unavailable";
    }
  }

  const enterNative = () => {
    if (!video.webkitEnterFullscreen) return false;
    try {
      video.webkitEnterFullscreen();
      return true;
    } catch {
      return false;
    }
  };

  // iPhone Safari cannot put the enclosing div into fullscreen. Enter the
  // video-specific native player synchronously while the tap is still active.
  if (page.fullscreenEnabled !== true && enterNative()) return "entered";
  if (container.requestFullscreen) {
    try {
      await container.requestFullscreen();
      return "entered";
    } catch {
      // Some WebKit containers expose the method but still reject it.
    }
  }
  return enterNative() ? "entered" : "unavailable";
}
