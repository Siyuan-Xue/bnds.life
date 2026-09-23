import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, stat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneUnreferenced } from "../scripts/media/prune-orphans.mjs";

test("unreferenced media is audited and retried without touching referenced files or links", async () => {
  const root = await mkdtemp(join(tmpdir(), "bnds-prune-"));
  const id = "00000000-0000-4000-8000-000000000091";
  try {
    const dir = join(root, "playback", id);
    await mkdir(dir, { recursive: true });
    await mkdir(join(root, "posters", id), { recursive: true });
    await writeFile(join(dir, "native.mp4"), "current");
    await writeFile(join(dir, "video.mp4"), "orphan");
    await symlink(join(root, "outside"), join(dir, "linked.mp4"));
    const refs = new Set([`playback/${id}/native.mp4`]);
    const preview = await pruneUnreferenced(root, refs);
    assert.deepEqual(preview.files.map((x) => x.key), [`playback/${id}/video.mp4`]);
    assert.equal((await stat(join(dir, "video.mp4"))).size, 6);
    const removed = await pruneUnreferenced(root, refs, { execute: true });
    assert.deepEqual(removed.files.map((x) => x.key), [`playback/${id}/video.mp4`]);
    await assert.rejects(stat(join(dir, "video.mp4")), { code: "ENOENT" });
    assert.equal((await stat(join(dir, "native.mp4"))).size, 7);
    assert.deepEqual((await pruneUnreferenced(root, refs, { execute: true })).files, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
