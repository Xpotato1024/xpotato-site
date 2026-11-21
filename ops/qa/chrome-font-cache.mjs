import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const cacheName = /^[a-f0-9]{32}-[a-zA-Z0-9_-]+\.cache-([0-9]+)$/u;
const maximumBytes = 64 * 1024 * 1024;

/** Copy fontconfig data, never a live browser cache, link or shared writable file. */
export async function copyChromeFontCache(source, destination, { generated = false } = {}) {
  if (!isAbsolute(source) || !isAbsolute(destination) || source === destination) {
    throw Error("Distinct absolute font cache directories required");
  }
  let entries;
  try {
    const directory = await lstat(source);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw Error("Font cache source must be a real directory");
    }
    entries = await readdir(source);
  } catch (error) {
    // A compatible read-only system font cache can leave Chrome's own cache empty.
    if (!generated || error.code !== "ENOENT") {
      throw error;
    }
    entries = [];
  }
  if (entries.length > 512) {
    throw Error("Font cache file budget exceeded");
  }
  await mkdir(destination, { mode: 0o700 });
  let files = 0,
    bytes = 0,
    ignoredAliases = 0;
  const versions = new Set();
  for (const name of entries.sort()) {
    const path = join(source, name),
      match = cacheName.exec(name),
      entry = await lstat(path);
    // Older Chrome versions emitted aliases for older cache formats. Ignore
    // those only while selecting generated data; exported seeds forbid links.
    if (generated && match && entry.isSymbolicLink()) {
      ignoredAliases++;
      continue;
    }
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
      throw Error("Font cache entries must be independent regular files: " + name);
    }
    if (name === "CACHEDIR.TAG" && generated) {
      continue;
    }
    if (!match) {
      throw Error("Unexpected font cache entry: " + name);
    }
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size <= 0) {
        throw Error("Invalid font cache file: " + name);
      }
      bytes += info.size;
      if (bytes > maximumBytes) {
        throw Error("Font cache byte budget exceeded");
      }
      const content = await handle.readFile();
      if (content.length !== info.size) {
        throw Error("Font cache changed while copying: " + name);
      }
      await writeFile(join(destination, name), content, { flag: "wx", mode: 0o600 });
      files++;
      versions.add(Number(match[1]));
    } finally {
      await handle.close();
    }
  }
  return { files, bytes, versions: [...versions].sort((a, b) => a - b), ignoredAliases };
}
