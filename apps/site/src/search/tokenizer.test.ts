import { describe, expect, it } from "vitest";
import { createSearchIndex } from "./config.js";
import { tokenize } from "./tokenizer.js";

describe("xpotato-ja-tech-bigram-v1", () => {
  it.each([
    ["新幹線", ["新幹", "幹線"]],
    ["プロテイン", ["プロ", "ロテ", "テイ", "イン"]],
    ["C++", ["c++"]],
    ["C#", ["c#"]],
    ["GPT-5.6", ["gpt-5.6", "gpt", "5.6"]],
  ])("tokenizes %s deterministically", (input, expected) => {
    expect(tokenize(input)).toEqual(expected);
  });

  it("preserves mixed Japanese and ASCII terms", () => {
    expect(tokenize("WSL ネットワーク")).toEqual(["wsl", "ネッ", "ット", "トワ", "ワー", "ーク"]);
  });

  it("ranks the compound target above a generic character fixture with fuzzy disabled", () => {
    const index = createSearchIndex();
    index.addAll([
      { id: "f8a847d4-8f5d-4bb0-a387-750f096479f2", route: "/target/", collection: "blog", title: "新幹線の設計", description: "鉄道", taxonomyText: "", headingText: "新幹線", bodyText: "新幹線 技術", cjkSingles: "新 幹 線" },
      { id: "90af3222-b287-412f-99eb-fcd9ee92a579", route: "/generic/", collection: "blog", title: "新しい設計", description: "一般", taxonomyText: "", headingText: "", bodyText: "新しい", cjkSingles: "新" },
    ]);
    expect(index.search("新幹線")[0]?.id).toBe("f8a847d4-8f5d-4bb0-a387-750f096479f2");
    expect(index.search("unrelated", { fuzzy: false })).toHaveLength(0);
  });
});
