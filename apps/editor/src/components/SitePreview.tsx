import { useEffect, useRef, useState } from "react";
import { collectionFromPath } from "@xpotato/editor-core/draft";
import { WorkspaceIcon } from "./WorkspaceIcon.js";
import type { SeriesNavigation } from "@xpotato/portable-content/series";
import type { LocalDraft } from "../data/storage.js";
import type { EditorSeriesPreview, PreviewMedia } from "../preview.js";
import "../site-preview.css";

export type { PreviewMedia } from "../preview.js";
export interface SitePreviewProps {
  draft: Pick<LocalDraft, "id" | "source" | "path">;
  media?: readonly PreviewMedia[];
  series?: readonly SeriesNavigation[];
  editorSeries?: EditorSeriesPreview;
}
const devices = [
  { id: "desktop", label: "PC", icon: "desktop", width: 1440 },
  { id: "tablet", label: "タブレット", icon: "tablet", width: 834 },
  { id: "phone", label: "スマートフォン", icon: "phone", width: 390 },
] as const;
const emptyMedia: readonly PreviewMedia[] = [];
const emptySeries: readonly SeriesNavigation[] = [];

export function SitePreview({
  draft,
  media = emptyMedia,
  series = emptySeries,
  editorSeries,
}: SitePreviewProps) {
  const [device, setDevice] = useState<(typeof devices)[number]["id"]>("phone");
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  const [available, setAvailable] = useState(390);
  const [height, setHeight] = useState(600);
  const [frameUrl, setFrameUrl] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const preview = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const disconnect = useRef<() => void>(() => {});
  const width = devices.find((item) => item.id === device)!.width;
  const scale = zoom === "fit" ? Math.min(1, available / width) : 1;

  useEffect(() => {
    const element = preview.current;
    const parentToolbar = element
      ?.closest(".document-workbench")
      ?.querySelector<HTMLElement>(".workbench-toolbar");
    if (!element || !parentToolbar) return;
    const update = () => {
      element.style.setProperty(
        "--cms-preview-toolbar-offset",
        `${parentToolbar.getBoundingClientRect().height}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parentToolbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setAvailable(Math.max(1, element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    setError("");
    void (async () => {
      const [{ default: stylesheet }, renderer] = await Promise.all([
        import("../preview-frame.css?inline"),
        import("../preview.js"),
      ]);
      const result = await renderer.previewDocument(draft.source, {
        media,
        series,
        ...(editorSeries ? { editorSeries } : {}),
        collection: collectionFromPath(draft.path),
      });
      if (!current) return;
      // Blob stylesheets need absolute font URLs; the source CSS remains the site's own files.
      const css = (stylesheet + "\n" + result.css).replace(
        /url\((['"]?)(\/[^)'"\s]+)\1\)/gu,
        (_, quote: string, path: string) =>
          `url(${quote}${new URL(path, location.origin).href}${quote})`,
      );
      const styleUrl = URL.createObjectURL(new Blob([css], { type: "text/css" }));
      urls.push(styleUrl);
      const html = renderer.previewFrameDocument(result, styleUrl);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      urls.push(url);
      setHeight(600);
      setWarnings(result.warnings);
      setFrameUrl(url);
    })().catch((reason: unknown) => {
      if (!current) return;
      setFrameUrl("");
      setError(reason instanceof Error ? reason.message : "プレビューを表示できません。");
    });
    return () => {
      current = false;
      disconnect.current();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [draft.id, draft.source, draft.path, media, series, editorSeries]);

  function measureDocument() {
    disconnect.current();
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    const update = () => {
      const next = Math.max(400, Math.ceil(document.body.getBoundingClientRect().height));
      setHeight((previous) => (previous === next ? previous : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    document.addEventListener("load", update, true);
    void document.fonts.ready.then(update);
    update();
    disconnect.current = () => {
      observer.disconnect();
      document.removeEventListener("load", update, true);
    };
  }

  return (
    <section ref={preview} className="cms-site-preview" aria-label="サイトのプレビュー">
      <div className="cms-site-preview-toolbar">
        <div className="cms-preview-devices" role="group" aria-label="プレビューの画面サイズ">
          {devices.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={device === item.id}
              aria-label={`${item.label}（${item.width}px）`}
              title={`${item.label}（${item.width}px）`}
              onClick={() => setDevice(item.id)}
            >
              <WorkspaceIcon name={item.icon} />
              <small aria-hidden="true">{item.width}px</small>
            </button>
          ))}
        </div>
        <label className="cms-preview-zoom">
          <span className="cms-sr-only">表示倍率</span>
          <select
            aria-label="表示倍率"
            value={zoom}
            onChange={(event) => setZoom(event.target.value as "fit" | "actual")}
          >
            <option value="fit">
              幅に合わせる（{Math.round(Math.min(1, available / width) * 100)}%）
            </option>
            <option value="actual">等倍（100%）</option>
          </select>
        </label>
      </div>
      {warnings.length > 0 && (
        <details className="cms-preview-warnings">
          <summary>未表示の内容を確認（{warnings.length}）</summary>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <p className="cms-preview-error" role="status">
          本文の構文を確認してください。 {error}
        </p>
      )}
      <div className="cms-preview-viewport" ref={viewport} data-zoom={zoom}>
        {frameUrl ? (
          <div
            className="cms-preview-stage"
            style={{ width: width * scale, height: height * scale }}
          >
            <iframe
              ref={frame}
              className="cms-preview-frame"
              title={`${devices.find((item) => item.id === device)!.label}表示 ${width}px`}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              src={frameUrl}
              width={width}
              height={height}
              style={{ width, height, transform: `scale(${scale})` }}
              onLoad={measureDocument}
            />
          </div>
        ) : (
          !error && (
            <p className="cms-preview-loading" role="status">
              プレビューを準備しています…
            </p>
          )
        )}
      </div>
    </section>
  );
}
