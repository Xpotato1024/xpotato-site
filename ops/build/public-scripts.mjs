import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { transformSync } from "esbuild";

const sourceDirectory = new URL("../../apps/site/public/scripts/", import.meta.url);

export function compilePublicScript(name, source) {
  if (!/^[a-z][a-z0-9-]*\.js$/u.test(name)) {
    throw new Error("PUBLIC_SCRIPT_NAME_INVALID");
  }
  // The marker is part of the offline-shell admission contract, not an executable directive.
  const banner = name === "prime-pwa.js" ? source.split(/\r?\n/u)[0] : undefined;
  const result = transformSync(source, {
    loader: "js",
    target: "es2022",
    charset: "utf8",
    minifyWhitespace: true,
    minifySyntax: false,
    minifyIdentifiers: false,
    legalComments: "inline",
    ...(banner ? { banner } : {}),
  });
  return result.code;
}

export async function readPublicScript(name) {
  if (!/^[a-z][a-z0-9-]*\.js$/u.test(name)) {
    throw new Error("PUBLIC_SCRIPT_NAME_INVALID");
  }
  const source = await readFile(new URL(name, sourceDirectory), "utf8");
  return Buffer.from(compilePublicScript(name, source));
}

export function publicScriptIntegration() {
  return {
    name: "readable-public-script-delivery",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const output = new URL("scripts/", dir);
        await mkdir(output, { recursive: true });
        for (const name of await readdir(sourceDirectory)) {
          if (name.endsWith(".js")) {
            // Only generated dist is rewritten; Git retains the readable source.
            await writeFile(new URL(name, output), await readPublicScript(name));
          }
        }
      },
    },
  };
}
