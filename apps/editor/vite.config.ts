import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDesignTokens } from "@xpotato/design-system/theme";
import { buildEditorPwa } from "../../ops/build/editor-pwa.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const [coreFonts, previewFonts] = await Promise.all([
  readFile(resolve(root, "packages/design-system/src/fonts-core.css"), "utf8"),
  readFile(resolve(root, "packages/design-system/src/fonts.css"), "utf8"),
]);
const fontNames = (css: string) =>
  new Set([...css.matchAll(/\/fonts\/([a-zA-Z0-9_.-]+\.woff2)/gu)].map((match) => match[1]!));
const coreFontNames = fontNames(coreFonts);
const allFontNames = new Set([...coreFontNames, ...fontNames(previewFonts)]);
const lazyFontPaths = [...allFontNames]
  .filter((name) => !coreFontNames.has(name))
  .map((name) => "/editor/fonts/" + name);
let written = false;
export default defineConfig({
  base: "/editor/",
  plugins: [
    {
      name: "editor-shared-design-assets",
      enforce: "pre",
      async transform(source, id) {
        const path = id.replaceAll("\\", "/").split("?")[0]!;
        if (path.endsWith("/katex/dist/katex.min.css")) {
          // Supported browsers use woff2; legacy alternatives must not inflate the offline shell.
          return source.replace(/src:[^;}]+/gu, (declaration) => {
            const woff2 = /url\([^)]*\.woff2[^)]*\)\s*format\(["']?woff2["']?\)/u.exec(declaration);
            return woff2 ? "src:" + woff2[0] : declaration;
          });
        }
        if (path.endsWith("/apps/editor/src/styles.css")) {
          return source.replace(
            '@import \"../../../packages/design-system/src/fonts-core.css\";',
            coreFonts.replaceAll("/fonts/", "/editor/fonts/"),
          );
        }
        if (path.endsWith("/apps/editor/src/preview-frame.css")) {
          return source.replace(
            '@import "../../../packages/design-system/src/fonts.css";',
            previewFonts.replaceAll("/fonts/", "/editor/fonts/"),
          );
        }
        return undefined;
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const match = /^\/editor\/fonts\/([a-zA-Z0-9_.-]+\.woff2)$/u.exec(request.url ?? "");
          if (!match || !allFontNames.has(match[1]!)) return next();
          void readFile(resolve(root, "apps/site/public/fonts", match[1]!))
            .then((bytes) => {
              response.setHeader("Content-Type", "font/woff2");
              response.end(bytes);
            })
            .catch(next);
        });
      },
      async transformIndexHtml(html) {
        const tokens = await loadDesignTokens();
        return html.replaceAll("__EDITOR_BRAND__", tokens.resolve("--accent"));
      },
      async generateBundle() {
        const tokens = await loadDesignTokens();
        const color = tokens.resolve("--accent"),
          background = tokens.resolve("--surface");
        this.emitFile({
          type: "asset",
          fileName: "manifest.webmanifest",
          source:
            JSON.stringify({
              id: "/editor/",
              name: "Xpotato Editor",
              short_name: "記事編集",
              start_url: "/editor/",
              scope: "/editor/",
              display: "standalone",
              lang: "ja",
              background_color: background,
              theme_color: color,
              icons: [
                { src: "/editor/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
              ],
            }) + "\n",
        });
        this.emitFile({
          type: "asset",
          fileName: "icon.svg",
          source:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="' +
            color +
            '"/><path d="M54 142V49h56l28 28v65zM108 49v30h30M74 99h44M74 119h30" fill="none" stroke="' +
            tokens.resolve("--on-accent") +
            '" stroke-width="8"/></svg>',
        });
        for (const name of allFontNames)
          this.emitFile({
            type: "asset",
            fileName: "fonts/" + name,
            source: await readFile(resolve(root, "apps/site/public/fonts", name)),
          });
      },
      writeBundle() {
        written = true;
      },
      async closeBundle() {
        if (written && process.env.NODE_ENV === "production")
          await buildEditorPwa(resolve(root, "apps/editor/dist"), { lazyFontPaths });
      },
    },
    tailwindcss(),
  ],
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
    proxy: { "/editor-api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames(asset) {
          return asset.names.some((name) => /\.woff2$/u.test(name))
            ? "fonts/[name]-[hash][extname]"
            : "assets/[name]-[hash][extname]";
        },
        manualChunks(id) {
          const path = id.replaceAll("\\", "/");
          if (path.includes("vite/preload-helper") || path.includes("commonjsHelpers"))
            return "runtime";
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//u.test(path)) return "react";
          if (/\/node_modules\/(?:@mdxeditor\/|@lexical\/|lexical\/|@radix-ui\/)/u.test(path))
            return "rich-editor";
          if (/\/node_modules\/(?:@codemirror\/|@lezer\/)/u.test(path)) return "source-editor";
          if (/\/node_modules\/katex\//u.test(path)) return "math";
          if (
            id.includes("node_modules") &&
            /remark|rehype|micromark|mdast|hast|unified|unist/u.test(id)
          )
            return "markdown";
          return undefined;
        },
      },
    },
  },
  esbuild: { jsx: "automatic" },
});
