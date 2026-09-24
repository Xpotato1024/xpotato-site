import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export interface DeployFileEntry {
  readonly relativePath: string;
  readonly byteSize: number;
  readonly sha256: string;
}

export interface DeployArtifactManifest {
  readonly schemaVersion: 1;
  readonly algorithm: "xpotato-site-deploy-tree-v1";
  readonly fileCount: number;
  readonly outputTreeSha256: string;
  readonly files: readonly DeployFileEntry[];
}

const hexSha256 = /^[0-9a-f]{64}$/u;
const domain = Buffer.from("xpotato-site-deploy-tree-v1\0", "ascii");

export const canonicalDistPath = (input: string): string => {
  const value = input.replaceAll("\\", "/");
  if (value !== value.normalize("NFC") || value.startsWith("/") || value.includes("\0")) {
    throw new Error("Noncanonical dist path: " + input);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Unsafe dist path: " + input);
  }
  return value;
};

export const compareUtf8Paths = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

export const createDeployArtifactManifest = (input: readonly DeployFileEntry[]): DeployArtifactManifest => {
  const files = input.map((entry) => {
    const relativePath = canonicalDistPath(entry.relativePath);
    if (relativePath !== entry.relativePath) throw new Error("Noncanonical manifest path");
    if (!Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0) throw new Error("Invalid file size");
    if (!hexSha256.test(entry.sha256)) throw new Error("Invalid file SHA256");
    return { relativePath, byteSize: entry.byteSize, sha256: entry.sha256 };
  }).sort((left, right) => compareUtf8Paths(left.relativePath, right.relativePath));
  if (files.length > 0xffffffff) throw new Error("Too many deploy files");
  for (let index = 1; index < files.length; index += 1) {
    if (files[index - 1]?.relativePath === files[index]?.relativePath) throw new Error("Duplicate dist path");
  }

  const hash = createHash("sha256");
  hash.update(domain);
  const count = Buffer.alloc(4);
  count.writeUInt32BE(files.length);
  hash.update(count);
  for (const file of files) {
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    if (pathBytes.length > 0xffffffff) throw new Error("Dist path too long");
    const pathLength = Buffer.alloc(4);
    pathLength.writeUInt32BE(pathBytes.length);
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(file.byteSize));
    hash.update(pathLength);
    hash.update(pathBytes);
    hash.update(size);
    hash.update(Buffer.from(file.sha256, "hex"));
  }
  return {
    schemaVersion: 1,
    algorithm: "xpotato-site-deploy-tree-v1",
    fileCount: files.length,
    outputTreeSha256: hash.digest("hex"),
    files,
  };
};

const collect = async (directory: string, root: string, output: DeployFileEntry[]): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symlink in deploy tree: " + absolute);
    if (entry.isDirectory()) {
      await collect(absolute, root, output);
    } else if (entry.isFile()) {
      const nativeRelative = relative(root, absolute);
      if (sep === "/" && nativeRelative.includes("\\")) throw new Error("Backslash in POSIX dist filename");
      const bytes = await readFile(absolute);
      output.push({
        relativePath: canonicalDistPath(nativeRelative.split(sep).join("/")),
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    } else {
      throw new Error("Unsupported deploy tree entry: " + absolute);
    }
  }
};

export const manifestFromDist = async (distDirectory: string): Promise<DeployArtifactManifest> => {
  const root = resolve(distDirectory);
  const files: DeployFileEntry[] = [];
  await collect(root, root, files);
  return createDeployArtifactManifest(files);
};
