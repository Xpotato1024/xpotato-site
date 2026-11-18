import { useId, useMemo, type Ref } from "react";
import { blockTree } from "@xpotato/editor-core/blocks";
import { MathPreview } from "./BlockPreview.js";
export interface CodeFieldsProps {
  code: string;
  language: string;
  meta: string;
  onCode: (value: string) => void;
  onLanguage: (value: string) => void;
  onMeta: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
}
export function CodeFields({
  code,
  language,
  meta,
  onCode,
  onLanguage,
  onMeta,
  inputRef,
}: CodeFieldsProps) {
  const id = useId();
  const math = language === "math";
  const labelMatch = /^label="(.*)"(?: print="source")?$/u.exec(meta);
  const label = labelMatch?.[1] ?? "";
  const printSource = / print="source"$/u.test(meta);
  const validMathMeta = /^label="[^"\r\n]{1,160}"(?: print="source")?$/u.test(meta);
  const updateLabel = (value: string, print = printSource) =>
    onMeta('label="' + value.replace(/[\r\n]/gu, "") + '"' + (print ? ' print="source"' : ""));
  return (
    <div className="cms-code-block">
      <div className="cms-code-options">
        <label>
          言語
          <input
            value={language}
            list={id}
            placeholder="text"
            onChange={(event) => onLanguage(event.target.value.replace(/\s/gu, ""))}
          />
        </label>
        <datalist id={id}>
          {[
            "text",
            "javascript",
            "typescript",
            "tsx",
            "html",
            "css",
            "json",
            "yaml",
            "bash",
            "python",
            "sql",
            "cpp",
            "math",
            "tex",
            "latex",
          ].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <label>
          {math ? "式の説明" : "表示設定"}
          <input
            value={math ? label : meta}
            maxLength={math ? 160 : undefined}
            placeholder={math ? "式を短く説明" : 'title="sample.ts"'}
            onChange={(event) =>
              math
                ? updateLabel(event.target.value)
                : onMeta(event.target.value.replace(/[\r\n]/gu, ""))
            }
          />
        </label>
      </div>
      <textarea
        ref={inputRef}
        className="cms-source-input"
        aria-label={math ? "TeX数式" : "コード"}
        value={code}
        rows={Math.min(18, Math.max(3, code.split("\n").length))}
        spellCheck={false}
        wrap="soft"
        onChange={(event) => onCode(event.target.value)}
      />
      {math && (
        <>
          <label className="cms-check-field">
            <input
              type="checkbox"
              checked={printSource}
              onChange={(event) => updateLabel(label, event.target.checked)}
            />
            印刷時はTeX原文を表示
          </label>
          {!validMathMeta && (
            <p className="cms-field-error">
              公開用に式の説明を入力してください。半角の引用符は使えません。
            </p>
          )}
          <MathPreview value={code} />
        </>
      )}
    </div>
  );
}
export function CodeBlock({
  source,
  onChange,
}: {
  source: string;
  onChange: (source: string) => void;
}) {
  const node = useMemo(() => blockTree(source).children?.[0], [source]);
  if (!node || node.type !== "code") return null;
  const update = (patch: { code?: string; language?: string; meta?: string }) => {
    const code = patch.code ?? node.value ?? "";
    const language = patch.language ?? node.lang ?? "";
    const meta = patch.meta ?? node.meta ?? "";
    const marker = /^\s*~/u.test(source) ? "~" : "`";
    const longest = [...code.matchAll(marker === "`" ? /`+/gu : /~+/gu)].reduce(
      (length, match) => Math.max(length, match[0].length),
      2,
    );
    const fence = marker.repeat(Math.max(3, longest + 1));
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    onChange(fence + language + (meta ? " " + meta : "") + newline + code + newline + fence);
  };
  return (
    <CodeFields
      code={node.value ?? ""}
      language={node.lang ?? ""}
      meta={node.meta ?? ""}
      onCode={(code) => update({ code })}
      onLanguage={(language) => update({ language })}
      onMeta={(meta) => update({ meta })}
    />
  );
}
