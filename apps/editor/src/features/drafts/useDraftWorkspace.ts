import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { updateDraft, type DraftMetadata } from "@xpotato/editor-core/draft";
import type { ContentCollection } from "@xpotato/content-contracts";
import {
  localDrafts,
  saveLocalDraft,
  saveRevision,
  type DraftRevision,
  type LocalDraft,
} from "../../data/storage.js";
import { createLocalDraft, mergeMediaSyncResult, parseLocalDraft } from "./model.js";

type EditSnapshot = Pick<LocalDraft, "source" | "annotations" | "pendingRegistryChanges">;
const snapshotOf = (draft: LocalDraft): EditSnapshot => ({
  source: draft.source,
  annotations: draft.annotations,
  pendingRegistryChanges: draft.pendingRegistryChanges,
});
const sameContent = (a: LocalDraft, b: LocalDraft) =>
  a.source === b.source &&
  JSON.stringify(a.annotations) === JSON.stringify(b.annotations) &&
  JSON.stringify(a.pendingRegistryChanges) === JSON.stringify(b.pendingRegistryChanges);

export function useDraftWorkspace(onError: (message: string) => void) {
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraftState] = useState<LocalDraft>(() => createLocalDraft());
  const [saved, setSaved] = useState<LocalDraft[]>([]);
  const [localStatus, setLocalStatus] = useState("保存準備中");
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });
  const current = useRef(draft);
  const history = useRef<{ undo: EditSnapshot[]; redo: EditSnapshot[]; at: number }>({
    undo: [],
    redo: [],
    at: 0,
  });
  const revisionAt = useRef(0);
  const parsed = useMemo(() => parseLocalDraft(draft.source), [draft.source]);
  const setDraft = useCallback((update: SetStateAction<LocalDraft>) => {
    const previous = current.current;
    const next = typeof update === "function" ? update(previous) : update;
    if (next.id !== previous.id) {
      history.current = { undo: [], redo: [], at: 0 };
      revisionAt.current = 0;
    } else if (!sameContent(previous, next)) {
      if (Date.now() - history.current.at > 750) history.current.undo.push(snapshotOf(previous));
      history.current.undo = history.current.undo.slice(-100);
      history.current.redo = [];
      history.current.at = Date.now();
    }
    current.current = next;
    setDraftState(next);
    setHistoryCount({ undo: history.current.undo.length, redo: history.current.redo.length });
  }, []);

  useEffect(() => {
    let active = true;
    void localDrafts()
      .then((entries) => {
        if (!active) return;
        entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        setSaved(entries);
        const opened = entries.find((entry) => !entry.archived);
        if (opened) setDraft(opened);
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setHydrated(true);
          onError("端末の保存領域を開けません。原稿を書き出して保全してください。");
        }
      });
    return () => {
      active = false;
    };
  }, [onError, setDraft]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    setLocalStatus("保存中…");
    const timer = setTimeout(() => {
      void (async () => {
        const latest = current.current;
        if (latest.id !== draft.id) return;
        await saveLocalDraft({ ...latest, savedAt: new Date().toISOString() });
        if (Date.now() - revisionAt.current > 30000) {
          await saveRevision(latest, "自動保存");
          revisionAt.current = Date.now();
        }
        const entries = await localDrafts();
        if (active) {
          setLocalStatus("この端末に保存済み");
          setSaved(entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
        }
      })().catch(() => {
        if (active) {
          setLocalStatus("保存失敗");
          onError("端末への保存に失敗しました。容量を確認し、原稿を書き出してください。");
        }
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, hydrated, onError]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      void saveLocalDraft({ ...current.current, savedAt: new Date().toISOString() }).catch(() =>
        onError("端末への保存に失敗しました。"),
      );
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [hydrated, onError]);

  async function persist(label = "編集を保存") {
    const snapshot = { ...current.current, savedAt: new Date().toISOString() };
    await saveLocalDraft(snapshot);
    await saveRevision(snapshot, label);
  }
  async function openLocal(next: LocalDraft) {
    if (next.id === current.current.id) return;
    const leaving = current.current.id;
    while (current.current.id === leaving) {
      const before = current.current;
      await persist();
      const latest = (await localDrafts()).find((entry) => entry.id === next.id);
      if (current.current !== before) continue;
      setDraft(latest ?? next);
      return;
    }
  }
  async function createNew(
    snapshot?: { branch: string; commit: string } | null,
    collection: ContentCollection = "blog",
    options?: { education?: boolean },
  ) {
    const next = createLocalDraft(collection, options);
    if (snapshot) {
      next.sourceBranch = snapshot.branch;
      next.baseCommit = snapshot.commit;
    }
    const leaving = current.current.id;
    while (current.current.id === leaving) {
      const before = current.current;
      await persist();
      if (current.current !== before) continue;
      setDraft(next);
      return;
    }
  }
  function edit(fields: Partial<DraftMetadata>, body?: string) {
    try {
      setDraft({ ...current.current, source: updateDraft(current.current.source, fields, body) });
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
  function travel(direction: "undo" | "redo") {
    const state = history.current;
    const target = state[direction].pop();
    if (!target) return;
    state[direction === "undo" ? "redo" : "undo"].push(snapshotOf(current.current));
    state.at = 0;
    const next = { ...current.current, ...target };
    current.current = next;
    setDraftState(next);
    setHistoryCount({ undo: state.undo.length, redo: state.redo.length });
  }
  async function restore(revision: DraftRevision) {
    if (revision.draftId !== current.current.id) return;
    await persist("履歴の復元前");
    if (revision.draftId !== current.current.id) return;
    history.current.at = 0;
    setDraft({
      ...current.current,
      source: revision.source,
      annotations: revision.annotations,
      pendingRegistryChanges: revision.pendingRegistryChanges,
    });
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
    canUndo: historyCount.undo > 0,
    canRedo: historyCount.redo > 0,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    restore,
  };
}
export type DraftWorkspace = ReturnType<typeof useDraftWorkspace>;
