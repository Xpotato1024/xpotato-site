import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { privateDraftOutputErrors } from "@xpotato/portable-content/private-output";

const allowed = /\.(?:html|css|js|json|xml|txt|svg|ico|png|webp|avif|jpg|jpeg|woff2?)$/i;
export async function assertReleaseDist(dir: string): Promise<void> {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry); const info = await lstat(path);
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error(`Unsafe output entry ${entry}`);
    if ((entry.startsWith('.') && !(entry === '.well-known' && info.isDirectory())) || /^(?:node_modules|src|private|raw|_worker\.js|_routes\.json)$/i.test(entry)) throw new Error(`Private/hidden/executable-hook output ${entry}`);
    if (privateDraftOutputErrors(path).length) throw new Error("Private draft output");
    if (info.isFile()
      && privateDraftOutputErrors(path, await readFile(path, "utf8")).length) throw new Error("Private draft output");
    if (info.isDirectory()) await assertReleaseDist(path);
    else if (!allowed.test(entry) && !['_headers', '_redirects'].includes(entry)) throw new Error(`Unexpected output class ${entry}`);
  }
}
