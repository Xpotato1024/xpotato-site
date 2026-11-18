import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { validatePortableMdx } from "@xpotato/portable-content";

let render: (props: Record<string, unknown>) => Promise<string>;
beforeAll(async () => {
  const source = await readFile(new URL("./Gallery.astro", import.meta.url), "utf8");
  const compiled = transform(source, { filename: "Gallery.astro", resultScopedSlot: true });
  const code = ts.transpileModule(compiled.code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
  new Function("require", "exports", code)((id: string) => {
    if (id === "astro/runtime/server/index.js") {
      return { ...runtime, createMetadata: () => ({}) };
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, module.exports);
  const container = await experimental_AstroContainer.create();
  render = (props) =>
    container.renderToString(module.exports.default, {
      props,
      slots: {
        default: '<figure><img src="/test.webp" alt="図" width="600" height="400"></figure>',
      },
    });
});

describe("portable responsive gallery", () => {
  it("renders independently editable viewport columns and keeps images static", async () => {
    const html = await render({
      columns: "4",
      tabletColumns: "2",
      mobileColumns: "1",
      gap: "small",
      fit: "cover",
    });
    expect(html).toContain('data-columns="4"');
    expect(html).toContain('data-tablet-columns="2"');
    expect(html).toContain('data-mobile-columns="1"');
    expect(html).toContain('data-gap="small"');
    expect(html).toContain('data-fit="cover"');
    expect(html).toContain('alt="図"');
    expect(html).not.toMatch(/<script|astro-island| style=/u);
  });

  it("retains legacy auto-fit diagrams unless layout controls are supplied", async () => {
    const legacy = await render({ layout: "diagrams" });
    expect(legacy).toContain('class="article-diagrams"');
    expect(legacy).not.toContain("article-gallery");
    const authored = await render({ layout: "diagrams", mobileColumns: "2" });
    expect(authored).toContain("article-gallery");
    expect(authored).toContain('data-mobile-columns="2"');
  });

  it("accepts portable literal layout settings and rejects unsupported columns", () => {
    expect(
      validatePortableMdx(
        '<Gallery columns="3" tabletColumns="2" mobileColumns="1" gap="large" fit="contain"><Figure asset="test" alt="図" /></Gallery>',
      ),
    ).toEqual([]);
    expect(validatePortableMdx('<Gallery columns="5"></Gallery>').length).toBeGreaterThan(0);
    expect(validatePortableMdx("<Gallery columns={2}></Gallery>").length).toBeGreaterThan(0);
  });
});
