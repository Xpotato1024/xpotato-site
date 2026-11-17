import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm, lstat, symlink, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { visualTheme, hash } from "./theme.mjs";
import { mermaidInput, chartInput, readableData, limits } from "./inputs.mjs";
import { staticSvg } from "./svg.mjs";
import { produceVisual } from "./cli.mjs";
import { prepareBrowserStorage, cleanupBrowserStorage } from "./browser-storage.mjs";
import { finishBrowserRuntime } from "./browser-cleanup.mjs";
import { localBrowser } from "./browser.mjs";
import { renderChart } from "./chart.mjs";
import { outlineChartText } from "./fonts.mjs";
import { fromHtml } from "hast-util-from-html";
import { sanitizeSvg } from "../../../packages/media-ingest/src/svg-sanitizer.mjs";
const require = createRequire(import.meta.url);
const base = resolve(".local");
await mkdir(base, { recursive: true });
const scratch = await mkdtemp(join(base, "technical-visual-tests-"));
after(async () => {
  await rm(scratch, { recursive: true });
});
const read = (name) =>
  readFile(new URL("../../../templates/technical-visuals/" + name, import.meta.url), "utf8");
const flow = await read("flow.mmd"),
  line = await read("line.json");

test("one theme resolves actual CSS tokens and keeps mathematical fonts separate", async () => {
  const theme = await visualTheme();
  assert.match(theme.font, /Zen Kaku/);
  assert.match(theme.accent, /^rgb\(/);
  assert.equal(
    theme.sha256,
    hash(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(theme).filter(([key]) => !["sha256", "tokenSourceSha256"].includes(key)),
        ),
      ),
    ),
  );
  assert.equal(
    JSON.parse(await readFile(require.resolve("mermaid/package.json"), "utf8")).version,
    "12.3.0",
  );
});
test("Mermaid source has declared graph structure, useful accessible metadata and bounded nodes", () => {
  const parsed = mermaidInput(flow);
  assert.equal(parsed.nodes.length, 4);
  assert.equal(parsed.edges.length, 3);
});
for (const [label, change] of [
  ["unknown graph", (s) => s.replace("flowchart TB", "sequenceDiagram")],
  ["config directive", (s) => s + '\n%%{init: {"securityLevel":"loose"}}%%'],
  ["click action", (s) => s + '\nclick Input "https://example.com"'],
  ["HTML label", (s) => s.replace("入力を検査", "<b>入力</b>")],
  ["external image", (s) => s + "\nimage https://example.com/a.svg"],
  ["class styling", (s) => s + "\nclassDef default fill:red"],
  ["missing description", (s) => s.replace(/^accDescr:.*\n/mu, "")],
  ["undefined node", (s) => s + "\nInput --> Missing"],
  ["duplicate node", (s) => s + '\nInput["別の入力"]'],
  [
    "graph budget",
    (s) => s + "\n" + Array.from({ length: limits.nodes }, (_, i) => `N${i}["節点"]`).join("\n"),
  ],
])
  test("rejects Mermaid " + label, () => assert.throws(() => mermaidInput(change(flow))));

for (const [label, change] of [
  [
    "URL data",
    (s) => {
      s.data = { url: "https://example.com/a.csv" };
    },
  ],
  [
    "expression",
    (s) => {
      s.transform = [{ calculate: "random()", as: "x" }];
    },
  ],
  [
    "configuration",
    (s) => {
      s.config = { font: "unapproved" };
    },
  ],
  [
    "image/link mark",
    (s) => {
      s.mark = "image";
    },
  ],
  [
    "empty rows",
    (s) => {
      s.data.values = [];
    },
  ],
  [
    "missing value",
    (s) => {
      delete s.data.values[0].value;
    },
  ],
  [
    "nonfinite",
    (s) => {
      s.data.values[0].value = 1e300;
    },
  ],
  [
    "unitless axis",
    (s) => {
      s.encoding.y.title = "値";
    },
  ],
  [
    "clipping domain",
    (s) => {
      s.encoding.y.scale = { domain: [0, 2] };
    },
  ],
  [
    "unsorted line",
    (s) => {
      s.data.values.reverse();
    },
  ],
  [
    "duplicate x",
    (s) => {
      s.data.values[1].time = 0;
    },
  ],
  [
    "unexpected row field",
    (s) => {
      s.data.values[0].href = "link";
    },
  ],
  [
    "oversized data",
    (s) => {
      s.data.values = Array.from({ length: 501 }, (_, i) => ({ time: i, value: i + 1 }));
    },
  ],
])
  test("rejects chart " + label, () => {
    const source = JSON.parse(line);
    change(source);
    assert.throws(() => chartInput(JSON.stringify(source)));
  });

test("all-zero observations remain zero and are rendered without fabricated positive marks", async () => {
  const source = JSON.parse(line);
  source.data.values.forEach((row) => {
    row.value = 0;
  });
  const rendered = await renderChart(JSON.stringify(source), await visualTheme());
  assert.ok(rendered.svg.includes("<path"));
  assert.deepEqual(rendered.metadata.data.values, source.data.values);
  assert.equal(rendered.tools.fontBinding.fallback, false);
  assert.equal(rendered.tools.fontBinding.family, "Zen Kaku Gothic New");
});

test("bar domain includes zero, rejects duplicate categories, data export preserves actual values", async () => {
  const bar = JSON.parse(await read("bar.json"));
  bar.encoding.y.scale = { domain: [1, 10] };
  assert.throws(() => chartInput(JSON.stringify(bar)), /domain/u);
  delete bar.encoding.y.scale;
  bar.data.values[0].category = "=SUM(A1)";
  const validated = chartInput(JSON.stringify(bar)),
    data = readableData(validated);
  assert.match(data.csv, /'=SUM/u);
  assert.match(data.markdown, /\| 3 \|/u);
  bar.data.values[1].category = bar.data.values[0].category;
  assert.throws(() => chartInput(JSON.stringify(bar)), /Duplicate/u);
});

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0L100 100" stroke="black"/></svg>';
test("reuses global sanitizer without relaxing it", () => {
  assert.equal(staticSvg(svg).svg, sanitizeSvg(svg));
  assert.equal(staticSvg(svg).width, 100);
});
for (const [label, source] of [
  ["doctype", "<!DOCTYPE svg>" + svg],
  ["entity", '<!ENTITY external SYSTEM "file:///private">' + svg],
  ["processing instruction", '<?xml version="1.0"?>' + svg],
  ["active handler", svg.replace("<path", '<path onclick="alert(1)"')],
  ["escaped handler", svg.replace("<path", '<path o&#110;load="x"')],
  ["foreignObject", svg.replace("</svg>", "<foreignObject/></svg>")],
  [
    "relative file image",
    svg.replace("</svg>", '<image href="../../authoring/secret.png"/></svg>'),
  ],
  ["encoded image URL", svg.replace("</svg>", '<image href="&#104;ttps://example.com"/></svg>')],
  ["file path", svg.replace("</svg>", "<text>C:\\private.txt</text></svg>")],
  ["style import", svg.replace("</svg>", '<style>@import "local.css";</style></svg>')],
  ["CSS attribute", svg.replace("<path", '<path style="fill:url(file:///private)"')],
  ["animation", svg.replace("</svg>", '<animate attributeName="x"/></svg>')],
  ["budget", svg.replace("100 100", "5000 5000")],
])
  test("rejects SVG " + label, () => assert.throws(() => staticSvg(source)));

for (const name of ["line", "scatter", "bar"])
  test(
    "actual Vega-Lite/Vega " + name + " renders static paths and accessible Japanese SVG",
    async () => {
      const rendered = await renderChart(await read(name + ".json"), await visualTheme());
      assert.match(rendered.svg, /<path/u);
      assert.match(rendered.svg, /<title id="technical-title">合成データ/u);
      assert.match(rendered.svg, /時間|入力|試料/u);
      assert.equal(rendered.tools.vega, "6.4.0");
      assert.equal(rendered.tools.vegaLite, "6.5.0");
      assert.ok(rendered.nodeCount > 40);
      assert.ok(rendered.width <= 360);
      assert.doesNotMatch(rendered.svg, /<script|<iframe|<image|foreignObject| style=|<style/u);
    },
  );
test("real chart CLI produces verifiable hashes, PNG and readable exact data; refuses overwrite", async () => {
  const output = join(scratch, "chart");
  const receipt = await produceVisual({
    mode: "chart",
    input: "templates/technical-visuals/line.json",
    output,
  });
  assert.equal(receipt.productionEligible, false);
  assert.equal(receipt.approval, false);
  assert.equal(receipt.offline.externalRequests, 0);
  for (const file of receipt.outputs)
    assert.equal(hash(await readFile(join(output, file.path))), file.sha256);
  assert.equal((await readFile(join(output, "poster.png"))).subarray(1, 4).toString(), "PNG");
  assert.deepEqual(
    JSON.parse(await readFile(join(output, "data.json"), "utf8")),
    JSON.parse(line).data.values,
  );
  await assert.rejects(lstat(join(output, "runtime")), /ENOENT/u);
  await assert.rejects(
    produceVisual({ mode: "chart", input: "templates/technical-visuals/line.json", output }),
    /EEXIST/u,
  );
});
test("invalid input/path escape leaves no success receipt or claimed directory", async () => {
  const input = join(scratch, "bad.json"),
    output = join(scratch, "bad");
  await writeFile(input, "{}");
  await assert.rejects(produceVisual({ mode: "chart", input, output }));
  await assert.rejects(lstat(output), /ENOENT/u);
  await assert.rejects(
    produceVisual({
      mode: "chart",
      input: "templates/technical-visuals/line.json",
      output: resolve("apps/site/public/bad"),
    }),
    /\.local/u,
  );
  await assert.rejects(
    produceVisual({
      mode: "chart",
      input: "templates/technical-visuals/line.json",
      output: ".local/bad",
    }),
    /absolute/u,
  );
});
test("symlink/junction output parent is rejected", async (t) => {
  const folder = join(scratch, "actual"),
    alias = join(scratch, "alias");
  await mkdir(folder);
  try {
    await symlink(folder, alias, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      t.skip("OS does not permit fixture links");
      return;
    }
    throw error;
  }
  await assert.rejects(
    produceVisual({
      mode: "chart",
      input: "templates/technical-visuals/line.json",
      output: join(alias, "out"),
    }),
    /Symlink|alias/u,
  );
});
test(
  "actual Mermaid offline browser render and cleanup",
  { skip: process.env.XPOTATO_TECHNICAL_VISUAL_BROWSER !== "1" && process.env.CI !== "true" },
  async () => {
    const parent = join(
      scratch,
      process.platform === "linux" ? "long-repository-layout-".repeat(5) : "nested-browser",
    );
    await mkdir(parent);
    const output = join(parent, "mermaid"),
      receipt = await produceVisual({
        mode: "mermaid",
        input: "templates/technical-visuals/flow.mmd",
        output,
      });
    assert.equal(receipt.tools.mermaid, "12.3.0");
    assert.equal(receipt.offline.externalRequests, 0);
    assert.match(await readFile(join(output, "figure.svg"), "utf8"), /入力を検査/u);
    await assert.rejects(lstat(join(output, "runtime")), /ENOENT/u);
  },
);

test("all outlined label glyphs are sibling SVG paths, never nested HTML paths", () => {
  const result = outlineChartText(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><text font-size="18" fill="#15141d">時間 (s)</text></svg>',
  );
  const tree = fromHtml(result.svg, { fragment: true });
  let paths = 0;
  function visit(n) {
    if (n.tagName === "path") {
      paths++;
      assert.equal(n.children.length, 0);
    }
    for (const child of n.children ?? []) visit(child);
  }
  visit(tree);
  assert.ok(paths >= 5);
  assert.equal(result.fontBinding.fallback, false);
});

for (const [name, body] of [
  ["unescaped ampersand", "<text>A & B</text>"],
  ["mismatched XML tags", "<g><text>value</g></text>"],
  ["duplicate XML attributes", '<rect x="0" x="1" width="2" height="2"/>'],
  ["unbound XML namespace", '<bad:path d="M0 0L1 1"/>'],
])
  test("strict XML regression: " + name, () => {
    assert.throws(() =>
      staticSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + body + "</svg>"),
    );
  });
test("Japanese and multidigit labels retain every outlined glyph after actual rasterization", async () => {
  const { default: sharp } = await import("sharp");
  for (const [label, count] of [
    ["123", 3],
    ["時間 (s)", 5],
  ]) {
    const result = outlineChartText(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64"><text x="12" y="40" font-size="24" fill="#15141d">' +
        label +
        "</text></svg>",
    );
    const baseline = await sharp(Buffer.from(result.svg)).ensureAlpha().raw().toBuffer();
    const tree = fromHtml(result.svg, { fragment: true });
    const glyphGroup = tree.children[0].children.find((node) => node.tagName === "g");
    assert.equal(glyphGroup.children.filter((node) => node.tagName === "path").length, count);
    for (let i = 0; i < count; i++) {
      const changed = structuredClone(tree);
      changed.children[0].children.find((node) => node.tagName === "g").children.splice(i, 1);
      const { toHtml } = await import("hast-util-to-html");
      const withoutGlyph = await sharp(Buffer.from(toHtml(changed)))
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.equal(
        withoutGlyph.equals(baseline),
        false,
        label + " glyph " + i + " must contribute visible pixels",
      );
    }
  }
});
test(
  "Linux browser sockets use a short owned temporary directory and keep caller environment unchanged",
  { skip: process.platform !== "linux" },
  async () => {
    const runtime = join(scratch, "long-layout-".repeat(12));
    await mkdir(runtime);
    const env = { HOME: "/home/example", TMPDIR: runtime, KEEP: "unchanged" },
      before = { ...env };
    const storage = await prepareBrowserStorage(runtime, { env });
    try {
      assert.match(storage.root, /^\/tmp\/xp-tv-[A-Za-z0-9]{6}$/u);
      assert.ok(storage.root.length < 40);
      assert.equal((await lstat(storage.root)).mode & 0o777, 0o700);
      assert.equal(storage.environment.TMPDIR, storage.root);
      assert.equal(storage.environment.HOME, env.HOME);
      assert.equal(storage.environment.XDG_CONFIG_HOME, join(storage.profile, "xdg-config"));
      assert.deepEqual(env, before);
      await assert.rejects(cleanupBrowserStorage({ ...storage, token: "wrong" }), /mismatch/u);
      await lstat(storage.root);
    } finally {
      await cleanupBrowserStorage(storage);
    }
    await assert.rejects(lstat(storage.root), /ENOENT/u);
    await lstat(runtime);
    await cleanupBrowserStorage(storage);
  },
);
for (const parentAlive of [false, true])
  test("Linux cleanup observes descendants independently of leader " + parentAlive, async () => {
    const events = [];
    const result = await finishBrowserRuntime(
      { pid: 43210, ownedGroup: true, storage: { token: "test" } },
      {
        platform: "linux",
        liveGroup: (pid) => {
          events.push("group:" + pid);
          return true;
        },
        livePid: () => {
          throw Error("Leader PID must not select Linux cleanup");
        },
        stopGroup: async (child) => {
          assert.equal(child.pid, 43210);
          events.push("stop");
        },
        waitGroup: async () => {
          events.push("verified");
        },
        removeStorage: async () => {
          events.push("remove");
        },
      },
    );
    assert.equal(result.forced, true);
    assert.deepEqual(events, ["group:43210", "stop", "verified", "remove"]);
  });
test("unverified or failed group cleanup preserves storage instead of deleting live process files", async () => {
  for (const phase of ["stop", "verify"]) {
    let removed = false;
    await assert.rejects(
      finishBrowserRuntime(
        { pid: 43210, ownedGroup: true, storage: {} },
        {
          platform: "linux",
          liveGroup: () => true,
          stopGroup: async () => {
            if (phase === "stop") throw Error("stop failed");
          },
          waitGroup: async () => {
            throw Error("verify failed");
          },
          removeStorage: async () => {
            removed = true;
          },
        },
      ),
      /failed/u,
    );
    assert.equal(removed, false);
  }
});
test("already exited Linux group is verified before removing storage without a second signal", async () => {
  const events = [];
  const result = await finishBrowserRuntime(
    { pid: 43210, ownedGroup: true, storage: {} },
    {
      platform: "linux",
      liveGroup: () => false,
      stopGroup: async () => {
        throw Error("Unexpected signal");
      },
      waitGroup: async () => events.push("verified"),
      removeStorage: async () => events.push("remove"),
    },
  );
  assert.equal(result.forced, false);
  assert.deepEqual(events, ["verified", "remove"]);
});
const linuxBrowser =
  process.platform === "linux" &&
  (process.env.CI === "true" || process.env.XPOTATO_TECHNICAL_VISUAL_BROWSER === "1");
for (const phase of ["log", "binding"])
  test(
    "browser setup I/O failure cleans its own short directory: " + phase,
    { skip: !linuxBrowser },
    async () => {
      const runtime = join(scratch, "io-failure-" + phase);
      await mkdir(runtime);
      if (phase === "log")
        await writeFile(join(runtime, "browser.log"), "preserve preexisting bytes");
      else await mkdir(join(runtime, "browser.json"));
      const before = (await readdir("/tmp")).filter((name) => name.startsWith("xp-tv-")).sort();
      await assert.rejects(localBrowser(runtime), /EEXIST|EISDIR/u);
      assert.deepEqual(
        (await readdir("/tmp")).filter((name) => name.startsWith("xp-tv-")).sort(),
        before,
      );
      if (phase === "log")
        assert.equal(
          await readFile(join(runtime, "browser.log"), "utf8"),
          "preserve preexisting bytes",
        );
    },
  );
test(
  "spawn rejection releases owned browser storage without waiting for an impossible child exit",
  { skip: !linuxBrowser },
  async () => {
    const runtime = join(scratch, "spawn-failure");
    await mkdir(runtime);
    const executable = join(runtime, "not-executable");
    await writeFile(executable, "not an executable", { mode: 0o600 });
    const previous = process.env.CHROME_PATH;
    const before = (await readdir("/tmp")).filter((name) => name.startsWith("xp-tv-")).sort();
    process.env.CHROME_PATH = executable;
    try {
      await assert.rejects(localBrowser(runtime), /EACCES/u);
    } finally {
      if (previous === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = previous;
    }
    assert.deepEqual(
      (await readdir("/tmp")).filter((name) => name.startsWith("xp-tv-")).sort(),
      before,
    );
  },
);
