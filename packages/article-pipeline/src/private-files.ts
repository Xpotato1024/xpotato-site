import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

export class DraftError extends Error {
  constructor(readonly code: string, readonly exitCode = 2) { super(code); }
}
export function fail(code: string, exitCode = 2): never { throw new DraftError(code, exitCode); }
export const inside = (root: string, path: string) => {
  const part = relative(root, path);
  return part !== "" && !part.startsWith(".." + sep) && part !== ".." && !isAbsolute(part);
};
export const noLinks = async (path: string) => {
  const absolute = resolve(path), parts = absolute.slice(parse(absolute).root.length).split(sep);
  let current = parse(absolute).root;
  for (const part of parts) {
    current = join(current, part);
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; });
    if (!info) break;
    if (info.isSymbolicLink()) fail("SYMLINK_PATH_DENIED");
  }
};
export const privateRoot = async (repository: string, requested?: string) => {
  const repo = await realpath(repository), standard = join(repo, ".local", "article-jobs");
  const path = resolve(requested ?? standard);
  if (requested && (!isAbsolute(requested) || requested.split(/[\\/]/u).includes(".."))) fail("PRIVATE_ROOT_INVALID");
  if (path !== standard && !(inside(standard, path) || inside(await realpath(tmpdir()), path) && path !== repo && !inside(repo, path))) fail("PRIVATE_ROOT_NOT_ALLOWED");
  await noLinks(path); await mkdir(path, {recursive:true,mode:0o700}); await noLinks(path);
  return realpath(path);
};
export const safeRead = async (path: string, max = 2 * 1024 * 1024) => {
  await noLinks(path);
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink > 1 || info.size > max) fail("INPUT_FILE_INVALID");
    const bytes = await file.readFile();
    if (bytes.length > max) fail("INPUT_FILE_TOO_LARGE");
    try { return new TextDecoder("utf-8", {fatal:true}).decode(bytes); } catch { return fail("INPUT_ENCODING_INVALID"); }
  } finally { await file.close(); }
};
export const atomic = async (path: string, text: string) => {
  await noLinks(dirname(path)); await noLinks(path);
  const temp = path + ".tmp-" + randomUUID();
  const file = await open(temp, "wx", 0o600);
  try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  try { await noLinks(path); await rename(temp, path); } catch (error) { await unlink(temp).catch(()=>{}); throw error; }
};
export const immutable = async (path: string, text: string) => {
  await noLinks(path);
  try { const file = await open(path, "wx", 0o600); try { await file.writeFile(text); await file.sync(); } finally { await file.close(); } }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await safeRead(path) !== text) throw error;
  }
};
export const locked = async <T>(directory: string, run: () => Promise<T>) => {
  await noLinks(directory);
  const path = join(directory, ".lock");
  let file;
  try { file = await open(path, "wx", 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return fail("JOB_LOCKED", 4);
    throw error;
  }
  try { await file.writeFile(String(process.pid)); return await run(); }
  finally { await file.close(); await unlink(path); }
};
