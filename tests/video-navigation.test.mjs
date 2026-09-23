import assert from "node:assert/strict";
import test from "node:test";
import {
  relatedLongVideos,
  videoPlaybackHref,
} from "../src/lib/video-navigation.ts";

test("short videos always open in the short-feed player", () => {
  const short = { id: "short 1", duration: 60 };
  assert.equal(videoPlaybackHref(short), "/recommend?v=short%201");
  assert.equal(videoPlaybackHref(short, true), "/recommend?v=short%201");
});

test("long videos use the watch page and preserve a home return source", () => {
  const long = { id: "long-1", duration: 60.001 };
  assert.equal(videoPlaybackHref(long), "/watch/long-1");
  assert.equal(videoPlaybackHref(long, true), "/watch/long-1?from=home");
});

test("long-video recommendations do not include the current video or shorts", () => {
  const videos = [
    { id: "current", duration: 120 },
    { id: "short", duration: 60 },
    { id: "another", duration: 61 },
  ];
  assert.deepEqual(relatedLongVideos(videos[0], videos), [videos[2]]);
});
