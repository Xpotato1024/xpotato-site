import { useEffect, useState } from "react";
import { localMedia } from "../../data/storage.js";
import type { PreviewMedia } from "../../components/SitePreview.js";
export function usePreviewMedia(draftId: string) {
  const [items, setItems] = useState<PreviewMedia[]>([]);
  useEffect(() => {
    let active = true,
      urls: string[] = [],
      generation = 0;
    const load = async () => {
      const request = ++generation;
      const media = await localMedia(draftId);
      if (!active || request !== generation) return;
      for (const url of urls) URL.revokeObjectURL(url);
      urls = media.map((item) => URL.createObjectURL(item.blob));
      setItems(
        media.map((item, index) => ({
          assetId: item.assetId,
          src: urls[index]!,
          ...(item.alt ? { alt: item.alt } : {}),
          ...(item.caption ? { caption: item.caption } : {}),
          ...(item.credit ? { credit: item.credit } : {}),
          ...(item.creditUrl ? { creditUrl: item.creditUrl } : {}),
        })),
      );
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ draftId: string }>).detail?.draftId === draftId) void load();
    };
    void load().catch(() => setItems([]));
    window.addEventListener("editor-media-changed", changed);
    return () => {
      active = false;
      generation++;
      window.removeEventListener("editor-media-changed", changed);
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [draftId]);
  return items;
}
