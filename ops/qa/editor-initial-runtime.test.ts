import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { measureEditorInitialRuntime } from "./editor-initial-runtime.js";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture() {
  const dist = await mkdtemp(join(tmpdir(), "editor-initial-"));
  directories.push(dist);
  await mkdir(join(dist, "editor/assets"), { recursive: true });
  const files = {
    "index-a.js":
      'import "./react-a.js"; export { shared } from "./shared-a.js"; const edit = () => import("./rich-a.js");',
    "react-a.js": "export const react = true;",
    "shared-a.js": 'import "./react-a.js"; export const shared = true;',
    "rich-a.js": 'import "./react-a.js"; export const rich = true;',
  };
  for (const [name, source] of Object.entries(files))
    await writeFile(join(dist, "editor/assets", name), source);
  const graph = Object.keys(files).map((name) => ({
    path: "/editor/assets/" + name,
    bytes: 100,
    gzipBytes: 50,
  }));
  return { dist, graph };
}
describe("editor initial runtime budget", () => {
  it("measures eager imports without excluding lazy editors from the full graph", async () => {
    const { dist, graph } = await fixture();
    const initial = await measureEditorInitialRuntime(
      dist,
      '<script type="module" src="/editor/assets/index-a.js"></script>',
      graph,
    );
    expect(initial.map((asset) => asset.path)).toEqual([
      "/editor/assets/index-a.js",
      "/editor/assets/react-a.js",
      "/editor/assets/shared-a.js",
    ]);
    expect(graph).toHaveLength(4);
  });
  it("counts a modulepreload even if its module is dynamically imported", async () => {
    const { dist, graph } = await fixture();
    const initial = await measureEditorInitialRuntime(
      dist,
      '<script type="module" src="/editor/assets/index-a.js"></script><link rel="modulepreload" href="/editor/assets/rich-a.js">',
      graph,
    );
    expect(initial).toHaveLength(4);
  });
  it("rejects a resource that was not admitted by the complete runtime graph", async () => {
    const { dist, graph } = await fixture();
    await expect(
      measureEditorInitialRuntime(
        dist,
        '<script src="/editor/assets/unknown-a.js"></script>',
        graph,
      ),
    ).rejects.toThrow("OUTSIDE_GRAPH");
    await writeFile(
      join(dist, "editor/assets/index-a.js"),
      'import "https://outside.invalid/editor.js";',
    );
    await expect(
      measureEditorInitialRuntime(dist, '<script src="/editor/assets/index-a.js"></script>', graph),
    ).rejects.toThrow("OUTSIDE_ROUTE");
  });
});
