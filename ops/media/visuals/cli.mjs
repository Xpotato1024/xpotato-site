import { readFile, writeFile, mkdir, lstat, realpath, rm } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { finishBrowserRuntime } from "./browser-cleanup.mjs";
import { hash, repository } from "./theme.mjs";
import { mermaidInput, chartInput, readableData, limits } from "./inputs.mjs";
const root = fileURLToPath(repository);
const inside = (parent, path) => {
  const rel = relative(parent, path);
  return !!rel && !rel.startsWith("..") && !isAbsolute(rel);
};

export async function noLinks(path) {
  const absolute = resolve(path);
  if (!inside(root, absolute)) throw Error("Path must be below this repository");
  let cursor = root;
  for (const part of relative(root, absolute).split(sep)) {
    cursor = join(cursor, part);
    const info = await lstat(cursor);
    if (info.isSymbolicLink() || (info.nlink > 1 && info.isFile()))
      throw Error("Symlink/junction/hardlink is forbidden");
    if (resolve(await realpath(cursor)).toLowerCase() !== resolve(cursor).toLowerCase())
      throw Error("Path alias is forbidden");
  }
}

async function workerRender(input) {
  await writeFile(join(input.runtime, "request.json"), JSON.stringify(input), {
    flag: "wx",
    mode: 0o600,
  });
  const child = spawn(
    process.execPath,
    [
      "--max-old-space-size=384",
      fileURLToPath(new URL("./worker.mjs", import.meta.url)),
      input.runtime,
    ],
    {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        TEMP: input.runtime,
        TMP: input.runtime,
        TMPDIR: input.runtime,
        ASTRO_TELEMETRY_DISABLED: "1",
      },
    },
  );
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, limits.timeoutMs);
  try {
    const code = await new Promise((yes, no) => {
      child.once("error", no);
      child.once("exit", yes);
    });
    if (timedOut) throw Error("Renderer timeout");
    const info = await lstat(join(input.runtime, "result.json"));
    if (info.size > 10 * 1024 * 1024) throw Error("Worker result budget exceeded");
    const reply = JSON.parse(await readFile(join(input.runtime, "result.json"), "utf8"));
    if (reply.type === "error") throw Error(reply.message);
    if (code !== 0 || reply.type !== "result")
      throw Error("Renderer failed without a success result");
    return reply.result;
  } finally {
    clearTimeout(timer);
    let binding;
    try {
      binding = JSON.parse(await readFile(join(input.runtime, "browser.json"), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        error.retainWorkspace = true;
        throw error;
      }
    }
    if (binding?.pid) {
      let cleaned;
      try {
        cleaned = await finishBrowserRuntime(binding);
      } catch (error) {
        error.retainWorkspace = true;
        throw error;
      }
      if (cleaned.forced)
        throw Error("Browser required forced parent cleanup; render is not successful");
    }
  }
}

export async function produceVisual({ mode, input, output }) {
  if (!["mermaid", "chart"].includes(mode)) throw Error("Use mermaid or chart");
  if (!isAbsolute(output ?? "") || !inside(resolve(root, ".local"), resolve(output)))
    throw Error("Output must be a fresh absolute directory below repository .local");
  const target = resolve(output),
    sourcePath = resolve(root, input ?? "");
  await noLinks(sourcePath);
  await noLinks(dirname(target));
  if (!sourcePath.endsWith(mode === "chart" ? ".json" : ".mmd"))
    throw Error("Input extension must match renderer");
  const info = await lstat(sourcePath);
  if (!info.isFile() || info.size > limits.inputBytes)
    throw Error("Input must be a bounded regular file");
  const bytes = await readFile(sourcePath),
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const metadata = mode === "chart" ? chartInput(source) : mermaidInput(source);
  await mkdir(target, { mode: 0o700 }); // Atomic fresh-directory claim. Never overwrite or remove someone else's directory.
  let success = false,
    retainWorkspace = false;
  try {
    const runtime = join(target, "runtime");
    await mkdir(runtime, { mode: 0o700 });
    const result = await workerRender({ mode, source, runtime });
    await rm(runtime, { recursive: true });
    const files = { ["source." + (mode === "chart" ? "json" : "mmd")]: bytes };
    files["figure.svg"] = result.svg;
    files["poster.png"] = Buffer.from(result.png, "base64");
    files["description.txt"] = metadata.description + "\n";
    if (mode === "chart") {
      const data = readableData(metadata);
      files["data.csv"] = data.csv;
      files["data.md"] = data.markdown;
      files["data.json"] = JSON.stringify(metadata.data.values, null, 2) + "\n";
    } else files["structure.json"] = JSON.stringify(metadata, null, 2) + "\n";
    const outputs = [];
    for (const [path, contents] of Object.entries(files)) {
      await writeFile(join(target, path), contents, { flag: "wx", mode: 0o600 });
      outputs.push({ path, sha256: hash(contents), sizeBytes: Buffer.byteLength(contents) });
    }
    const receipt = {
      schemaVersion: 1,
      protocol: "xpotato-private-technical-visual-v1",
      kind: "local-technical-visual",
      productionEligible: false,
      approval: false,
      mode,
      inputSha256: hash(bytes),
      tools: result.tools,
      theme: result.theme,
      dimensions: { width: result.width, height: result.height },
      minimumMobileTextPx: result.minimumMobileText,
      offline: { externalRequests: result.externalRequests },
      browserCleanup: result.browserCleanup,
      outputs,
      limits,
      limitations: [
        "Local renderer result only; no factual, rights, visual-audit or publication approval",
        "Charts use verified site-font outlines; Mermaid loads verified local site-font subsets for rasterization; no font files are exported",
        "Use poster.png through the existing media pipeline; SVG is a private editing/source artifact",
      ],
    };
    // Receipt is last, and only after the worker/browser have exited and runtime has been removed.
    await writeFile(join(target, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    success = true;
    return receipt;
  } catch (error) {
    retainWorkspace = error.retainWorkspace === true;
    throw error;
  } finally {
    if (!success && !retainWorkspace) {
      await noLinks(target);
      await rm(target, { recursive: true });
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [mode, ...args] = process.argv.slice(2),
      options = {};
    if (args.length !== 4)
      throw Error(
        "Usage: content:visual -- mermaid|chart --input source --output <fresh absolute .local directory>",
      );
    for (let i = 0; i < args.length; i += 2) {
      if (!["--input", "--output"].includes(args[i]) || options[args[i]])
        throw Error("Unknown/duplicate option");
      options[args[i]] = args[i + 1];
    }
    const receipt = await produceVisual({
      mode,
      input: options["--input"],
      output: options["--output"],
    });
    console.log(
      JSON.stringify({
        output: options["--output"],
        inputSha256: receipt.inputSha256,
        dimensions: receipt.dimensions,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
