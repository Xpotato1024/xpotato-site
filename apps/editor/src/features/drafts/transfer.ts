import { draftPath, parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import {
  localMedia,
  saveLocalDraft,
  saveLocalMedia,
  type LocalDraft,
  type LocalMedia,
} from "../../data/storage.js";
import { createLocalDraft } from "./model.js";

interface DraftBundle {
  version: number;
  draft: LocalDraft;
  media: ({ base64: string; mime: string } & Omit<LocalMedia, "blob">)[];
}

export async function exportDraftBundle(draft: LocalDraft): Promise<Blob> {
  const media = await localMedia(draft.id);
  if (media.reduce((sum, item) => sum + item.blob.size, 0) > 32 * 1024 * 1024) {
    throw new Error(
      "まとめて書き出せる画像は32 MiBまでです。画像を同期するか、記事を分けて保全してください。",
    );
  }
  const encoded = await Promise.all(
    media.map(async ({ blob, ...item }) => {
      let value = "";
      for (const byte of new Uint8Array(await blob.arrayBuffer())) {
        value += String.fromCharCode(byte);
      }
      return { ...item, mime: blob.type, base64: btoa(value) };
    }),
  );
  return new Blob([JSON.stringify({ version: 1, draft, media: encoded })], {
    type: "application/json",
  });
}

export async function importDraftFile(file: File): Promise<LocalDraft> {
  if (file.size > 48 * 1024 * 1024) {
    throw new Error("インポートファイルが大きすぎます。");
  }
  const text = await file.text();
  if (/\.mdx?$/iu.test(file.name)) {
    const content = parseDraft(text);
    const next = {
      ...createLocalDraft(),
      source: updateDraft(text, { draft: true }),
      path: draftPath(content.data.id),
    };
    await saveLocalDraft(next);
    return next;
  }
  const value = JSON.parse(text) as DraftBundle;
  if (value.version !== 1 || !value.draft || !Array.isArray(value.media)) {
    throw new Error("IMPORT_FORMAT_INVALID");
  }
  parseDraft(value.draft.source);
  // 同じbundleの再取込でも既存の端末下書きを置換しない。
  const id = crypto.randomUUID();
  const next = { ...value.draft, id, savedAt: new Date().toISOString() };
  for (const item of value.media) {
    const { base64, mime, ...metadata } = item;
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const { inspectImage } = await import("@xpotato/editor-core/image-inspection");
    inspectImage(bytes, item.kind);
    await saveLocalMedia({
      ...metadata,
      id: crypto.randomUUID(),
      draftId: id,
      blob: new Blob([bytes], { type: mime }),
    });
  }
  await saveLocalDraft(next);
  return next;
}
