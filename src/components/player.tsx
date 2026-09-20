"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, type Video } from "~/lib/videos";
import { Icon } from "./icon";
import { isPlaybackShortcut } from "~/lib/shortcuts";
import { videoAspectRatio } from "~/lib/video-layout";

export function Player({
  video,
  active = true,
  feed = false,
  onAspectRatio,
  children,
}: {
  video: Video;
  active?: boolean;
  feed?: boolean;
  onAspectRatio?: (source: string, ratio: number) => void;
  children?: React.ReactNode;
}) {
  const media = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(video.duration);
  const [error, setError] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const element = media.current;
    if (!element) return;
    const syncMetadata = () => {
      const ratio = videoAspectRatio(element.videoWidth, element.videoHeight);
      if (ratio !== undefined) onAspectRatio?.(video.source, ratio);
      if (Number.isFinite(element.duration)) setDuration(element.duration);
    };
    element.addEventListener("loadedmetadata", syncMetadata);
    element.addEventListener("resize", syncMetadata);
    // A cached video can finish loading before React hydrates its event handlers.
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) syncMetadata();
    return () => {
      element.removeEventListener("loadedmetadata", syncMetadata);
      element.removeEventListener("resize", syncMetadata);
    };
  }, [onAspectRatio, video.source]);

  const play = useCallback(() => {
    const element = media.current;
    if (element) void element.play().catch(() => setPlaying(false));
  }, []);
  const toggle = useCallback(() => {
    const element = media.current;
    if (!element) return;
    if (element.paused) {
      userPaused.current = false;
      play();
    } else {
      userPaused.current = true;
      element.pause();
    }
  }, [play]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    const element = media.current;
    if (active && !document.hidden) {
      userPaused.current = false;
      play();
    } else element?.pause();
    return () => element?.pause();
  }, [active, play, video.id]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) media.current?.pause();
      else if (active && !userPaused.current) play();
    };
    const fullChange = () =>
      setFull(document.fullscreenElement === container.current);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullChange);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullChange);
    };
  }, [active, play]);
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (!isPlaybackShortcut(event)) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input,textarea,select,button,a,[contenteditable],dialog[open]",
        )
      )
        return;
      if (document.querySelector("dialog[open]")) return;
      if (["k", " "].includes(event.key)) {
        event.preventDefault();
        toggle();
      }
      if (event.key === "m") setMuted((value) => !value);
      if (event.key === "f") fullscreen();
      if (["ArrowLeft", "ArrowRight"].includes(event.key) && media.current) {
        event.preventDefault();
        media.current.currentTime = Math.max(
          0,
          Math.min(
            duration,
            media.current.currentTime + (event.key === "ArrowLeft" ? -5 : 5),
          ),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, duration, fullscreen, toggle]);

  function seek(value: string) {
    if (media.current) {
      media.current.currentTime = Number(value);
      setCurrent(Number(value));
    }
  }
  return (
    <div
      ref={container}
      className={`player ${feed ? "feed-player" : "watch-player"} ${playing ? "is-playing" : "is-paused"}`}
      data-video-id={video.id}
    >
      <video
        ref={media}
        src={video.source}
        poster={video.poster}
        muted={muted}
        playsInline
        loop={feed}
        preload={active ? "auto" : "none"}
        aria-label={`${video.title}，占位视频`}
        onClick={toggle}
        onDoubleClick={fullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onVolumeChange={(event) => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        onError={() => setError(true)}
      />
      {feed && <div className="feed-scrim" aria-hidden="true" />}
      {error ? (
        <div className="player-error">
          视频暂时无法播放
          <button
            onClick={() => {
              setError(false);
              media.current?.load();
              play();
            }}
          >
            重新加载
          </button>
        </div>
      ) : (
        !playing && (
          <button
            className="center-play"
            onClick={toggle}
            aria-label="播放视频"
          >
            <Icon name="play" width={40} height={40} />
          </button>
        )
      )}
      <div className="player-controls">
        {feed && (
          <div className="feed-top-controls">
            <button
              className="icon-button"
              aria-label={playing ? "暂停" : "播放"}
              onClick={toggle}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button
              className="icon-button"
              aria-label={muted ? "开启声音" : "静音"}
              onClick={() => setMuted(!muted)}
            >
              <Icon name={muted ? "muted" : "volume"} />
            </button>
            <button
              className="icon-button feed-fullscreen"
              aria-label={full ? "退出全屏" : "全屏"}
              onClick={fullscreen}
            >
              <Icon name={full ? "shrink" : "fullscreen"} />
            </button>
          </div>
        )}
        <div className="player-bottom">
          <input
            className="seek"
            type="range"
            min={0}
            max={duration || 20}
            step={0.1}
            value={current}
            onChange={(event) => seek(event.target.value)}
            aria-label="播放进度"
            aria-valuetext={`${formatDuration(current)} / ${formatDuration(duration)}`}
            style={{
              background: `linear-gradient(to right, var(--red) 0%, var(--red) ${(current / (duration || 1)) * 100}%, #ffffff60 ${(current / (duration || 1)) * 100}%, #ffffff60 100%)`,
            }}
          />
          {!feed && (
            <div className="playback-toolbar">
              <button
                className="icon-button"
                onClick={toggle}
                aria-label={playing ? "暂停" : "播放"}
              >
                <Icon name={playing ? "pause" : "play"} />
              </button>
              <div className="volume-control">
                <button
                  className="icon-button"
                  onClick={() => setMuted(!muted)}
                  aria-label={muted ? "开启声音" : "静音"}
                >
                  <Icon name={muted ? "muted" : "volume"} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  aria-label="音量"
                  onChange={(event) => {
                    if (media.current) {
                      media.current.volume = Number(event.target.value);
                      media.current.muted = Number(event.target.value) === 0;
                    }
                  }}
                />
              </div>
              <span className="playback-time">
                {formatDuration(current)} / {formatDuration(duration)}
              </span>
              <span className="toolbar-space" />
              <button
                className="icon-button"
                aria-label={full ? "退出全屏" : "全屏"}
                onClick={fullscreen}
              >
                <Icon name={full ? "shrink" : "fullscreen"} />
              </button>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
