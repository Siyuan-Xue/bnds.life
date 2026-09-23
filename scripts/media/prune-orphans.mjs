import { lstat, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { hashFile, uuidPattern } from "./files.mjs";

function sameFile(before, after) {
  return (
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs
  );
}

export async function pruneUnreferenced(root, referenced, { execute = false } = {}) {
  const base = await lstat(root);
  if (!base.isDirectory() || base.isSymbolicLink())
    throw new Error("媒体根目录无效");
  const files = [];
  const errors = [];
  for (const folder of ["playback", "posters"]) {
    const folderPath = join(root, folder);
    const parent = await lstat(folderPath);
    if (!parent.isDirectory() || parent.isSymbolicLink())
      throw new Error(`媒体目录无效：${folder}`);
    for (const id of await readdir(folderPath)) {
      if (!uuidPattern.test(id)) continue;
      const videoDir = join(folderPath, id);
      const dirInfo = await lstat(videoDir);
      if (!dirInfo.isDirectory() || dirInfo.isSymbolicLink()) continue;
      for (const name of await readdir(videoDir)) {
        if (!/^[A-Za-z0-9_.-]+$/.test(name) || name === "." || name === "..")
          continue;
        const key = `${folder}/${id}/${name}`;
        if (referenced.has(key)) continue;
        const path = join(videoDir, name);
        const before = await lstat(path);
        if (!before.isFile() || before.isSymbolicLink()) continue;
        const sha256 = await hashFile(path);
        const entry = { key, size: before.size, sha256 };
        if (execute) {
          try {
            if (!sameFile(before, await lstat(path)))
              throw new Error("文件在核验后发生变化");
            await unlink(path);
          } catch (error) {
            errors.push({ ...entry, error: error.message });
            continue;
          }
        }
        files.push(entry);
      }
    }
  }
  return { execute, files, errors };
}
