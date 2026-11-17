import { useEffect, useMemo, useRef, useState } from "react";
import { updateDraft, type DraftMetadata } from "@xpotato/editor-core/draft";
import { localDrafts, saveLocalDraft, type LocalDraft } from "../../data/storage.js";
import { createLocalDraft, mergeMediaSyncResult, parseLocalDraft } from "./model.js";

export function useDraftWorkspace(onError: (message: string) => void) {
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<LocalDraft>(createLocalDraft);
  const [saved, setSaved] = useState<LocalDraft[]>([]);
  const [localStatus, setLocalStatus] = useState("保存準備中");
  const current = useRef(draft);
  current.current = draft;
  const parsed = useMemo(() => parseLocalDraft(draft.source), [draft.source]);

  useEffect(() => {
    let active = true;
    void localDrafts()
      .then((entries) => {
        if (!active) {
          return;
        }
        entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        setSaved(entries);
        if (entries[0]) {
          setDraft(entries[0]);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setHydrated(true);
          onError("ローカル保存領域を開けませんでした。書き出して保全してください。");
        }
      });
    return () => {
      active = false;
    };
  }, [onError]);

  useEffect(() => {
    // 初期表示用の空原稿で、IndexedDBにある下書きを上書きしない。
    if (!hydrated) {
      return;
    }
    let active = true;
    setLocalStatus("保存中…");
    const timer = setTimeout(() => {
      void saveLocalDraft({ ...draft, savedAt: new Date().toISOString() })
        .then(async () => {
          const entries = await localDrafts();
          if (active) {
            setLocalStatus("この端末に保存済み");
            setSaved(entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
          }
        })
        .catch(() => {
          if (active) {
            setLocalStatus("保存失敗");
            onError("端末内への保存に失敗しました。容量を確認し、MDXを書き出してください。");
          }
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, hydrated, onError]);

  async function persist() {
    await saveLocalDraft({ ...current.current, savedAt: new Date().toISOString() });
  }

  async function openLocal(next: LocalDraft) {
    await persist();
    setDraft(next);
  }

  async function createNew(snapshot?: { branch: string; commit: string } | null) {
    await persist();
    const next = createLocalDraft();
    if (snapshot) {
      next.sourceBranch = snapshot.branch;
      next.baseCommit = snapshot.commit;
    }
    setDraft(next);
  }

  function edit(fields: Partial<DraftMetadata>, body?: string) {
    try {
      const latest = current.current;
      const source = updateDraft(latest.source, fields, body);
      setDraft({ ...latest, source });
    } catch (error) {
      onError(error instanceof Error ? error.message : "原稿を更新できませんでした");
    }
  }

  function setSource(source: string) {
    setDraft((latest) => ({ ...latest, source }));
  }

  function acceptMediaSync(synced: LocalDraft) {
    setDraft((latest) => mergeMediaSyncResult(latest, synced));
  }

  return {
    hydrated,
    draft,
    saved,
    localStatus,
    current,
    parsed,
    setDraft,
    persist,
    openLocal,
    createNew,
    edit,
    setSource,
    acceptMediaSync,
  };
}
export type DraftWorkspace = ReturnType<typeof useDraftWorkspace>;
