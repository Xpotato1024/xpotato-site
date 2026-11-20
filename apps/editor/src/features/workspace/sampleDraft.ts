import {
  anchorSelection,
  applyReviewProposal,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";
import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import { moduleSource } from "@xpotato/editor-core/blocks";
import type { LocalDraft, LocalMedia } from "../../data/storage.js";
import { hashBlob } from "../../media/optimize.js";
import { createLocalDraft } from "../drafts/model.js";

// A 491-byte, four-colour diagram fixture. PNG keeps bundle import and private media
// staging on the same supported image path as a user's images; SVG is not accepted there.
const groupDiagram =
  "iVBORw0KGgoAAAANSUhEUgAAAeAAAACgCAMAAADjJU9/AAAADFBMVEX59/p0U5vYzt/u6PMXYo9JAAABmklEQVR42u3bu46gMBBFQR7//88kkBC0kWVjuV0nnGB0pytBXu22SZIkSZK0YLtSBRiwAGsuYF8ieb6nAAMWYAEWYAEWYAEGLMACLMACLMACDDj64TGo0h9gV7wLMOBn8DmgL4e0K9oFGLBDAnZIwIABAwYMGLBdgAEDBuyQgAHPCtz2Pze2O6RdgAEDBuyQgAEDBgwYMGC7AAP2kuUlyyEBAwYMGDBgwHYBtgswYIcE7JCAAQMGDBgwYLsAAwYM+P41fas9pF2AAQMG7JDZgX3M+IoGDBgwYMCA7QIMGDBgh/QW7aHDSxZgwIAB2+Ut2i7AgB0SsEMCBgwYMGDAgO3y0OGhAzBghwQM2Fu0jyxf0YAB2wUYMGDADgnYIQEDBgwYMGDAdgEGDHhp4Pp/7eh7SLsAAwYM2CEBAwYMGDBgwHZ56PDQARiwQwIGDBgwYMCA7QJsF2DADgnYIQEDBgwYMOA/gMdUPqRd0S7AgDVzgAELsAALsAALsAADBgxYgAVYgAVYgAG/f6g8AQYswJoHWJIkSZKkBboAp+2czCYuizMAAAAASUVORK5CYII=";

const openText = "この操作は誰にとっても簡単です。";
const proposalText = "見出しを動かすと記事全体を移動できます。";
const resolvedText = "画像の説明は、図だけでは分からない点を補います。";
const beforeAppliedText = "修正案はすべて自動で本文へ反映されます。";

const sampleComparison = [
  "<Comparison>",
  '<ComparisonCase label="条件A">',
  "本文のみで説明する例です。この文章は、条件Aの中で編集できます。",
  "</ComparisonCase>",
  '<ComparisonCase label="条件B">',
  "図と本文を組み合わせた例です。",
  '<Figure asset="sample-block-group" alt="条件Bに添えたブロック構成のサンプル図" />',
  "</ComparisonCase>",
  '<ComparisonCase label="条件C">',
  "- 確認すること\n- 変更すること",
  "</ComparisonCase>",
  "</Comparison>",
].join("\n\n");

const sampleCharts = [
  moduleSource("LineChart", {
    title: "折れ線の操作サンプル",
    description: "入力と表示を試す合成データです。実測結果ではありません。",
    kind: "line",
    xLabel: "時間 (任意単位)",
    yLabel: "値 (任意単位)",
    series: JSON.stringify([
      {
        label: "系列A",
        points: [
          { x: 0, y: 2 },
          { x: 1, y: 5 },
          { x: 2, y: 3 },
          { x: 3, y: 6 },
        ],
      },
      {
        label: "系列B",
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 3 },
          { x: 2, y: 5 },
          { x: 3, y: 4 },
        ],
      },
    ]),
  }),
  moduleSource("LineChart", {
    title: "散布図の操作サンプル",
    description: "点の追加と表示を試す合成データです。実測結果や相関を示しません。",
    kind: "scatter",
    xLabel: "横軸 (任意単位)",
    yLabel: "縦軸 (任意単位)",
    series: JSON.stringify([
      {
        label: "系列A",
        points: [
          { x: 2, y: 1 },
          { x: 1, y: 3 },
          { x: 2, y: 2 },
          { x: 3, y: 4 },
        ],
      },
      {
        label: "系列B",
        points: [
          { x: 1, y: 3 },
          { x: 2, y: 1 },
          { x: 1, y: 2 },
          { x: 3, y: 3 },
        ],
      },
    ]),
  }),
  moduleSource("LineChart", {
    title: "近似と理論式の操作サンプル",
    description: "近似・理論式と軸の余白を試す合成データです。実測結果ではありません。",
    kind: "analysis",
    xLabel: "時間 (任意単位)",
    yLabel: "値 (任意単位)",
    xPadding: "8",
    yPadding: "10",
    series: JSON.stringify([
      {
        label: "系列A",
        role: "observed",
        fit: { method: "linear" },
        points: [
          { x: 0, y: 1.1 },
          { x: 1, y: 2.8 },
          { x: 2, y: 5.2 },
          { x: 3, y: 6.9 },
        ],
      },
      {
        label: "系列B",
        role: "formula",
        formula: { expression: "2*x+1", xMin: 0, xMax: 4, samples: 201 },
      },
    ]),
  }),
];

const sampleBody = [
  "これはCMSの操作を試すためのサンプルです。AI下書きと添削の状態を模擬しています。文や画像を書き換えながら、構成の変更と修正案の確認を試してください。",
  "<Group>",
  "## 構成をまとめて動かす",
  "このグループには見出し、段落、図が入っています。グループのハンドルで移動すると、中身をまとめて並べ替えられます。内側のブロックも個別に編集できます。",
  openText,
  "この一文には、説明が曖昧な箇所への指摘が付いています。本文の印を押すと、その文に対する指摘を確認できます。自分でも文章を選んで、直してほしい点を添えてみてください。",
  proposalText,
  "こちらには修正案が付いています。元の文と提案を見比べてから、本文へ反映できます。指摘だけの状態と、修正案がある状態の表示の違いも確認してください。",
  '<Figure asset="sample-block-group" alt="一つの枠の中に三つの文章ブロックを並べた図" caption="外側の枠がグループ、内側の三つの枠が個々のブロックです。" />',
  resolvedText,
  "この指摘は確認を終えた状態です。解決済みの指摘も履歴として残るため、以前に何を確認したのかを振り返れます。サンプル内の指摘は、実際の記事に対する監査結果ではありません。",
  "</Group>",
  "<Group>",
  "## 本文を確認して直す",
  "この節では、数式やコードを含む本文を試せます。上の三つのモードを切り替えると、ブロックの編集、サイトでの表示、MDXの記法をそれぞれ確認できます。",
  '```math label="数式表示のサンプル"\n\\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^{N}(x_i-\\mu)^2}\n```',
  '```python\nblocks = ["見出し", "本文", "画像"]\nfor block in blocks:\n    print(block)\n```',
  "数式はTeX記法、コードは言語名付きのブロックです。ここにある図やコードは操作を試すための素材です。数値の測定結果や、コードを実行して得た結果を示すものではありません。",
  beforeAppliedText,
  "この文には、修正案を反映した状態を用意しています。元の文と修正後の文は添削パネルで確認できます。本文には修正後の文章だけが入り、指摘や差分の情報は本文と別に保存されます。",
  '<Figure asset="sample-block-group" alt="複数の文章ブロックを一つにまとめた図" caption="この節も、見出し・本文・数式・コード・図をまとめて移動できます。" />',
  "</Group>",
  "## 比較とグラフを試す",
  "比較の条件は追加・並べ替えができます。グラフの設定では、CSVの取り込み、近似方法の選択、理論式の追加ができます。軸の範囲・余白も変えられます。図とデータ表、式・計算条件を開いて確認してください。",
  sampleComparison,
  ...sampleCharts,
].join("\n\n");

export interface SampleDraft {
  draft: LocalDraft;
  media: LocalMedia[];
}

/** Called by the sample action only. The caller owns saving/opening these new records. */
export async function createSampleDraft(): Promise<SampleDraft> {
  const initial = createLocalDraft("blog");
  const contentId = parseDraft(initial.source).data.id;
  const createdAt = initial.savedAt;
  const comment = (
    body: string,
    quote: string,
    instruction: string,
    status: ReviewComment["status"] = "open",
  ): ReviewComment => ({
    id: crypto.randomUUID(),
    contentId,
    // Each quoted sample is a complete paragraph, so it survives a group move.
    anchor: anchorSelection(body, {
      quote,
      blockSource: quote,
      blockStart: body.indexOf(quote),
    }),
    instruction,
    createdAt,
    status,
  });
  const withProposal = (
    target: ReviewComment,
    replacement: string,
    reason: string,
  ): ReviewComment => ({
    ...target,
    proposal: {
      id: crypto.randomUUID(),
      expected: target.anchor.quote,
      replacement,
      reason,
      receivedAt: createdAt,
    },
  });

  const applied = applyReviewProposal(
    sampleBody,
    withProposal(
      comment(sampleBody, beforeAppliedText, "自動反映と誤解される説明を直してください。"),
      "修正案を確認し、「修正案を反映」を押すと本文に反映されます。",
      "利用者が内容を確認してから反映する操作を明記しました。これは反映済み状態のサンプルです。",
    ),
  );
  const annotations: ReviewComment[] = [
    comment(
      applied.body,
      openText,
      "「誰にとっても簡単」という断定を、具体的な操作の説明に変えてください。",
    ),
    withProposal(
      comment(applied.body, proposalText, "見出し単体とグループの移動を区別してください。"),
      "グループを動かすと、見出し・本文・画像をまとめて移動できます。",
      "移動する対象をグループと明示し、一緒に移動する内容を具体化しました。",
    ),
    comment(
      applied.body,
      resolvedText,
      "図の枠が何を表すか、キャプションで説明されていることを確認しました。",
      "resolved",
    ),
    applied.comment,
  ];
  const draft: LocalDraft = {
    ...initial,
    source: updateDraft(
      initial.source,
      {
        title: "操作サンプル：記事の構成と添削",
        description:
          "グループ移動、数式・コード、比較・グラフ、AI下書きへの指摘と修正案を試す操作サンプルです。添削は模擬データです。",
      },
      applied.body + "\n",
    ),
    producer: "ai",
    annotations,
  };
  const blob = new Blob(
    [Uint8Array.from(atob(groupDiagram), (character) => character.charCodeAt(0))],
    { type: "image/png" },
  );
  const hash = await hashBlob(blob);
  return {
    draft,
    media: [
      {
        id: crypto.randomUUID(),
        draftId: draft.id,
        assetId: "sample-block-group",
        blob,
        originalBytes: blob.size,
        sourceSha256: hash,
        sha256: hash,
        kind: "technical",
        transform: "identity-v1",
        createdAt,
        originalName: "sample-block-group.png",
        sourceRetained: true,
        alt: "一つの枠の中に三つの文章ブロックを並べた操作サンプルの図",
      },
    ],
  };
}
