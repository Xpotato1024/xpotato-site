import { describe, expect, it } from "vitest";
import {
  semanticContentModulePropsSchemas,
  contentModuleRecordSchema,
} from "@xpotato/content-contracts/content";
import { validatePortableMdx } from "./index.js";

describe("portable content groups", () => {
  it("admits nested flow groups with Markdown and approved modules, without layout props", () => {
    expect(contentModuleRecordSchema.shape.id.options).toContain("Group");
    expect(semanticContentModulePropsSchemas.Group.parse({})).toEqual({});
    expect(
      validatePortableMdx(
        '<Group>\n\n## 見出し\n\n本文。\n\n<Figure asset="one" alt="図" />\n\n<Group>\n\n- 一\n- 二\n\n</Group>\n\n</Group>',
      ),
    ).toEqual([]);
    expect(validatePortableMdx('<Group class="custom">\n\n本文\n\n</Group>')).not.toEqual([]);
    expect(validatePortableMdx("<Group onClick={run}>\n\n本文\n\n</Group>")).not.toEqual([]);
  });

  it("does not turn grouping into an inline element or an escape from parent contracts", () => {
    expect(validatePortableMdx("本文 <Group>途中</Group> 続き").join("\n")).toContain(
      "Group must be a flow block",
    );
    for (const parent of ["Gallery", "Steps", "DiagnosticList", "ArticleEndnote"]) {
      expect(
        validatePortableMdx(`<${parent}>\n<Group>\n\n本文\n\n</Group>\n</${parent}>`).join("\n"),
      ).toContain(`Group is not a direct child of ${parent}`);
    }
    expect(
      validatePortableMdx("<Group>\n<ArticleEndnote>\n\n補足\n\n</ArticleEndnote>\n</Group>").join(
        "\n",
      ),
    ).toContain("ArticleEndnote must be a top-level block");
  });

  it("still rejects runtime code and unknown elements inside nested groups", () => {
    for (const child of ["{run()}", "<script>alert(1)</script>", "<FutureModule />"]) {
      expect(
        validatePortableMdx(`<Group>\n\n<Group>\n\n${child}\n\n</Group>\n\n</Group>`),
      ).not.toEqual([]);
    }
  });
});
