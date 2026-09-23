import assert from "node:assert/strict";
import test from "node:test";
import { togglePlayerFullscreen } from "../src/lib/player-fullscreen.ts";

test("iPhone-style video fullscreen uses the video API while element fullscreen is unavailable", async () => {
  const calls = [];
  const container = { requestFullscreen: () => calls.push("element") };
  const video = { webkitEnterFullscreen: () => calls.push("video") };
  const page = { fullscreenEnabled: false, fullscreenElement: null };

  assert.equal(await togglePlayerFullscreen(container, video, page), "entered");
  assert.deepEqual(calls, ["video"]);
});

test("desktop fullscreen enters and exits the enclosing player", async () => {
  const calls = [];
  const container = {
    requestFullscreen: async () => {
      calls.push("enter");
      page.fullscreenElement = container;
    },
  };
  const page = {
    fullscreenEnabled: true,
    fullscreenElement: null,
    exitFullscreen: async () => {
      calls.push("exit");
      page.fullscreenElement = null;
    },
  };
  const video = { webkitEnterFullscreen: () => calls.push("native") };

  assert.equal(await togglePlayerFullscreen(container, video, page), "entered");
  assert.equal(await togglePlayerFullscreen(container, video, page), "exited");
  assert.deepEqual(calls, ["enter", "exit"]);
});

test("native video fullscreen exits through its own API", async () => {
  const calls = [];
  const video = {
    webkitDisplayingFullscreen: true,
    webkitExitFullscreen: () => calls.push("exit-native"),
  };
  assert.equal(
    await togglePlayerFullscreen({}, video, {
      fullscreenEnabled: false,
      fullscreenElement: null,
    }),
    "exited",
  );
  assert.deepEqual(calls, ["exit-native"]);
});

test("unsupported fullscreen reports failure instead of silently succeeding", async () => {
  assert.equal(
    await togglePlayerFullscreen({}, {}, {
      fullscreenEnabled: false,
      fullscreenElement: null,
    }),
    "unavailable",
  );
});
