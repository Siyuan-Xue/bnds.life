import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  lstat,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteVideoFiles,
  removeOriginalFiles,
  removeDeletedIncoming,
  deletionRoot,
} from "../scripts/media/deletion.mjs";

const source = "the deleted original";
const sha = createHash("sha256").update(source).digest("hex");
const exists = async (path) =>
  lstat(path).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
test("physical deletion removes every owned asset and work version and exact incoming copies only", async () => {
  const temp = await mkdtemp(join(tmpdir(), "bnds-delete-files-"));
  const root = join(temp, "media");
  const id = randomUUID();
  const other = randomUUID();
  try {
    for (const folder of [
      "originals",
      "playback",
      "posters",
      ".work",
      "incoming",
    ])
      await mkdir(join(root, folder), { recursive: true });
    for (const folder of ["originals", "playback", "posters"]) {
      await mkdir(join(root, folder, id));
      await writeFile(join(root, folder, id, "obsolete.bin"), "old output");
      await writeFile(join(root, folder, id, "current.bin"), "output");
      await mkdir(join(root, folder, other));
      await writeFile(join(root, folder, other, "keep.bin"), "other");
    }
    await mkdir(join(root, ".work", `${id}-native-interrupted`));
    await writeFile(
      join(root, ".work", `${id}-native-interrupted`, "native.mp4"),
      "partial",
    );
    await mkdir(join(root, ".work", `${other}-keep`));
    await mkdir(join(root, "incoming", "nested"));
    await writeFile(join(root, "incoming", "renamed.mov"), source);
    await writeFile(join(root, "incoming", "nested", "copy.uploading"), source);
    await writeFile(
      join(root, "incoming", "partial.uploading"),
      source.slice(0, 5),
    );
    await writeFile(join(root, "incoming", "keep.mov"), "other");
    await writeFile(join(temp, "local-original.mov"), source);
    await symlink(
      join(temp, "local-original.mov"),
      join(root, "playback", id, "external"),
    );
    await symlink(temp, join(root, "incoming", "external-dir"));
    await symlink(
      join(temp, "local-original.mov"),
      join(root, "incoming", "external-file"),
    );
    assert.equal((await deleteVideoFiles(root, id, sha)).incomingRemoved, 2);
    for (const folder of ["originals", "playback", "posters"]) {
      assert.equal(await exists(join(root, folder, id)), false);
      assert.equal(await exists(join(root, folder, other, "keep.bin")), true);
    }
    assert.equal(
      await exists(join(root, ".work", `${id}-native-interrupted`)),
      false,
    );
    assert.equal(await exists(join(root, ".work", `${other}-keep`)), true);
    assert.equal(
      await readFile(join(temp, "local-original.mov"), "utf8"),
      source,
    );
    assert.equal(
      await exists(join(root, "incoming", "partial.uploading")),
      true,
    );
    assert.equal(await exists(join(root, "incoming", "external-file")), true);
    assert.equal((await deleteVideoFiles(root, id, sha)).incomingRemoved, 0);
    await writeFile(join(root, "incoming", "late.mov"), source);
    assert.equal(await removeDeletedIncoming(root, [sha]), 1);
    // A previously cached incomplete upload must be rehashed after it changes.
    await writeFile(join(root, "incoming", "partial.uploading"), source);
    assert.equal(await removeDeletedIncoming(root, [sha]), 1);
    await assert.rejects(deleteVideoFiles(root, "../outside", sha), /无效/);
    await assert.rejects(deletionRoot("/"), /专用/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("refuses symlinked storage parent without touching external files", async () => {
  const temp = await mkdtemp(join(tmpdir(), "bnds-delete-safety-"));
  const root = join(temp, "media");
  const outside = join(temp, "outside");
  const id = randomUUID();
  try {
    await mkdir(root);
    await mkdir(join(outside, id), { recursive: true });
    await writeFile(join(outside, id, "keep"), source);
    await symlink(outside, join(root, "originals"));
    await assert.rejects(deleteVideoFiles(root, id, sha), /符号链接/);
    assert.equal(await readFile(join(outside, id, "keep"), "utf8"), source);
    await symlink(root, join(temp, "root-link"));
    await assert.rejects(deletionRoot(join(temp, "root-link")), /符号链接/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("cleanup retention defaults to seven complete days and rejects unsafe configuration", async () => {
  const { cleanupCutoff } = await import("../scripts/media/deletion.mjs");
  const now = new Date("2026-09-21T19:00:00.000Z");
  assert.equal(
    cleanupCutoff(undefined, now).toISOString(),
    "2026-09-14T19:00:00.000Z",
  );
  assert.equal(cleanupCutoff(0, now).toISOString(), now.toISOString());
  assert.equal(
    cleanupCutoff(30, now).toISOString(),
    "2026-08-22T19:00:00.000Z",
  );
  for (const days of [-1, 1.5, NaN, Infinity, "0", 36501])
    assert.throws(() => cleanupCutoff(days, now), /RETENTION/);
});

test("retire originals is idempotent and preserves playback, posters and incoming", async () => {
  const root = await mkdtemp(join(tmpdir(), "bnds-retire-"));
  const id = randomUUID();
  try {
    for (const folder of ["originals", "playback", "posters"]) {
      await mkdir(join(root, folder, id), { recursive: true });
      await writeFile(join(root, folder, id, "file"), source);
    }
    await mkdir(join(root, "incoming"));
    await writeFile(join(root, "incoming", "source"), source);
    await removeOriginalFiles(root, id);
    await removeOriginalFiles(root, id);
    assert.equal(await exists(join(root, "originals", id)), false);
    for (const folder of ["playback", "posters"])
      assert.equal(
        await readFile(join(root, folder, id, "file"), "utf8"),
        source,
      );
    assert.equal(
      await readFile(join(root, "incoming", "source"), "utf8"),
      source,
    );
    await deleteVideoFiles(root, id, sha);
    assert.equal(await exists(join(root, "playback", id)), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
