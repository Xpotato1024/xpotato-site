import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";
import {
  primaryReviewMark,
  reviewStateLabel,
  splitReviewText,
  type LocatedReviewMark,
} from "../../features/review/review-marks.js";

export function MathPreview({ value }: { value: string }) {
  const [result, setResult] = useState({ html: "", error: "", loading: true });
  useEffect(() => {
    let active = true;
    void import("./math.js")
      .then(({ safeMathMarkup }) => {
        if (!active) return;
        try {
          setResult({ html: safeMathMarkup(value), error: "", loading: false });
        } catch (caught) {
          setResult({
            html: "",
            error:
              caught instanceof Error
                ? caught.message.replace(/^KaTeX parse error:\s*/u, "")
                : "数式を確認してください。",
            loading: false,
          });
        }
      })
      .catch(() => {
        if (active)
          setResult({
            html: "",
            error: "数式の表示を読み込めませんでした。TeX原文は保持されています。",
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <>
      {result.html && (
        <div
          className="cms-math-preview"
          aria-label={value}
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      )}
      {result.loading && <small role="status">数式を読み込み中…</small>}
      {result.error && (
        <div className="cms-math-error">
          <code>{value}</code>
          <small role="status">{result.error}</small>
        </div>
      )}
    </>
  );
}
const richNodeTypes = new Set([
  "root",
  "paragraph",
  "text",
  "heading",
  "strong",
  "emphasis",
  "delete",
  "inlineCode",
  "link",
  "break",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
  "table",
  "tableRow",
  "tableCell",
  "code",
]);
export function canEditRich(source: string): boolean {
  try {
    const visit = (node: BlockNode): boolean =>
      richNodeTypes.has(node.type) && (node.children?.every(visit) ?? true);
    return visit(blockTree(source));
  } catch {
    return false;
  }
}
interface PreviewReview {
  source: string;
  marks: readonly LocatedReviewMark[];
  activeCommentId: string | null | undefined;
}

function markedText(
  text: string,
  marks: readonly LocatedReviewMark[],
  review: PreviewReview,
  key: number,
): ReactNode {
  const primary = primaryReviewMark(marks);
  if (!primary) return text;
  return (
    <mark
      key={key}
      className="cms-review-mark"
      data-review-state={primary.state}
      data-review-id={marks.map((mark) => mark.id).join(" ")}
      data-review-active={marks.some((mark) => mark.id === review.activeCommentId) || undefined}
      title={marks.map((mark) => reviewStateLabel(mark.state)).join("・")}
    >
      {text}
    </mark>
  );
}

function renderText(node: BlockNode, index: number, review: PreviewReview): ReactNode {
  const text = node.value ?? "";
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (!review.marks.length || start === undefined || end === undefined) return text;
  const raw = review.source.slice(start, end);
  let textStart: number | undefined = raw === text ? start : undefined;
  if (node.type === "inlineCode") {
    const ticks = raw.match(/^`+/u)?.[0].length ?? 0;
    if (ticks && raw.slice(ticks, -ticks) === text) textStart = start + ticks;
  }
  // Escapes/entities can change display length. Mark a fully covered leaf only, never guess offsets.
  if (textStart === undefined)
    return markedText(
      text,
      review.marks.filter((mark) => mark.start <= start && mark.end >= end),
      review,
      index,
    );
  return (
    <Fragment key={index}>
      {splitReviewText(text, textStart, review.marks).map((segment, segmentIndex) =>
        markedText(segment.text, segment.marks, review, segmentIndex),
      )}
    </Fragment>
  );
}

function renderNode(node: BlockNode, index: number, review: PreviewReview): ReactNode {
  const render = (child: BlockNode, childIndex: number) => renderNode(child, childIndex, review);
  const children = node.children?.map(render);
  switch (node.type) {
    case "root":
      return <Fragment key={index}>{children}</Fragment>;
    case "text":
      return renderText(node, index, review);
    case "paragraph":
      return <p key={index}>{children}</p>;
    case "heading": {
      switch (node.depth) {
        case 1:
          return <h1 key={index}>{children}</h1>;
        case 2:
          return <h2 key={index}>{children}</h2>;
        case 3:
          return <h3 key={index}>{children}</h3>;
        case 4:
          return <h4 key={index}>{children}</h4>;
        case 5:
          return <h5 key={index}>{children}</h5>;
        default:
          return <h6 key={index}>{children}</h6>;
      }
    }
    case "strong":
      return <strong key={index}>{children}</strong>;
    case "emphasis":
      return <em key={index}>{children}</em>;
    case "delete":
      return <del key={index}>{children}</del>;
    case "inlineCode":
      return <code key={index}>{renderText(node, index, review)}</code>;
    case "link":
      return (
        <a key={index} title={node.title ?? node.url}>
          {children}
        </a>
      );
    case "break":
      return <br key={index} />;
    case "blockquote":
      return <blockquote key={index}>{children}</blockquote>;
    case "list":
      return node.ordered ? (
        <ol key={index} start={node.start}>
          {children}
        </ol>
      ) : (
        <ul key={index}>{children}</ul>
      );
    case "listItem":
      return (
        <li key={index}>
          {typeof node.checked === "boolean" && (
            <span aria-hidden="true" className="cms-preview-check">
              {node.checked ? "☑" : "☐"}{" "}
            </span>
          )}
          {children}
        </li>
      );
    case "thematicBreak":
      return <hr key={index} />;
    case "code":
      return node.lang === "math" ? (
        <MathPreview key={index} value={node.value ?? ""} />
      ) : (
        <pre key={index}>
          <code>{node.value}</code>
        </pre>
      );
    case "table":
      return (
        <div className="cms-table-scroll" key={index}>
          <table>
            <thead>
              <tr>
                {node.children?.[0]?.children?.map((cell, i) => (
                  <th key={i} style={{ textAlign: node.align?.[i] ?? "left" }}>
                    {cell.children?.map(render)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.children?.slice(1).map((row, i) => (
                <tr key={i}>
                  {row.children?.map((cell, j) => (
                    <td key={j} style={{ textAlign: node.align?.[j] ?? "left" }}>
                      {cell.children?.map(render)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <code key={index}>{node.value ?? ""}</code>;
  }
}
export function BlockPreview({
  source,
  reviewMarks = [],
  activeCommentId,
}: {
  source: string;
  reviewMarks?: readonly LocatedReviewMark[] | undefined;
  activeCommentId?: string | null | undefined;
}) {
  const tree = useMemo(() => {
    try {
      return blockTree(source);
    } catch {
      return null;
    }
  }, [source]);
  return (
    <div className="cms-prose cms-block-preview">
      {tree ? (
        renderNode(tree, 0, { source, marks: reviewMarks, activeCommentId })
      ) : (
        <pre>{source}</pre>
      )}
    </div>
  );
}
