import { lstat, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { privateDraftOutputErrors } from "@xpotato/portable-content/private-output";

const downloads: { path: string; sha256: string; sizeBytes: number }[] = JSON.parse(
  await readFile(new URL("../../../../scripts/release/artifact/approved-public-downloads.json", import.meta.url), "utf8"),
);

const allowed = /\.(?:html|css|js|json|xml|txt|svg|ico|png|webp|avif|jpg|jpeg|woff2?)$/i;
export async function assertReleaseDist(dir: string): Promise<void> {
  await walkReleaseDist(dir, '');
}
async function walkReleaseDist(dir: string, prefix: string): Promise<void> {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry); const info = await lstat(path);
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error(`Unsafe output entry ${entry}`);
    if ((entry.startsWith('.') && !(entry === '.well-known' && info.isDirectory())) || /^(?:node_modules|src|private|raw|_worker\.js|_routes\.json)$/i.test(entry)) throw new Error(`Private/hidden/executable-hook output ${entry}`);
    if (privateDraftOutputErrors(path).length) throw new Error("Private draft output");
    if (info.isFile()
      && privateDraftOutputErrors(path, await readFile(path, "utf8")).length) throw new Error("Private draft output");
    const download = downloads.find(item => item.path === `${prefix}${entry}`);
    if (download) {
      if (!info.isFile() || info.size !== download.sizeBytes
        || createHash("sha256").update(await readFile(path)).digest("hex") !== download.sha256) {
        throw new Error(`Approved public download bytes mismatch: ${download.path}`);
      }
      continue;
    }
    if (info.isDirectory()) await walkReleaseDist(path, `${prefix}${entry}/`);
    else if (!allowed.test(entry) && !['_headers', '_redirects'].includes(entry)
      && `${prefix}${entry}` !== 'tools/prime-factorizer/manifest.webmanifest') throw new Error(`Unexpected output class ${entry}`);
  }
}
