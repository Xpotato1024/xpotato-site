import { useEffect, useMemo, useRef, useState } from "react";
import type { TaxonomySnapshot } from "@xpotato/editor-core/draft";
import type { GitSnapshot } from "@xpotato/editor-core/git";
import { previewRegistryChanges, type EditorRegistryChanges } from "@xpotato/editor-core/registry";
import { createRegistryPullRequest, query, request, saveRegistryChanges } from "../../data/api.js";
import { readWorkspaceRecord, writeWorkspaceRecord } from "../../data/storage.js";
import type { PreparedWorkspace } from "../git/useGitWorkspace.js";
import {
  acceptRegistrySave,
  changeRegistryState,
  finishRegistryTransfer,
  reconcileRegistrySnapshot,
  withRegistryChanges,
  type RegistryState,
} from "./registryState.js";
import schema from "../../../../../content/registry/editor.json";

const localState = (): RegistryState => ({
  id: "registry:local",
  branch: "",
  sourceBranch: "main",
  commit: "",
  manifest: schema as TaxonomySnapshot,
});
const failureReason = (error: unknown) =>
  error instanceof Error ? error.message : "REGISTRY_CONFLICT";
function issueLabel(reason: string) {
  if (reason === "GIT_CONFLICT") {
    return "作業ブランチに新しい更新があります。手元の変更を保持したまま、最新情報と照合してください。";
  }
  if (reason === "SERIES_CONFLICT") {
    return "同じ連載がGit側でも変更されています。手元の変更は保持しています。所属記事と順序を確認してください。";
  }
  if (reason.startsWith("TAXONOMY_")) {
    return "追加予定のタグ・分類がGit側の情報と重複しています。手元の追加内容は保持しています。名前とIDを確認してください。";
  }
  return "管理情報を照合できませんでした。手元の変更は保持しています。";
}

export function useRegistryWorkspace(
  onError: (message: string) => void,
  onNotice: (message: string) => void,
) {
  const [state, setState] = useState<RegistryState>(localState);
  const current = useRef(state);
  const records = useRef(new Map<string, RegistryState>());
  const [hydrated, setHydrated] = useState(false);
  const ready = useRef(false);
  const [status, setStatus] = useState("読込中");
  const mounted = useRef(true);
  const callbacks = useRef({ onError, onNotice });
  callbacks.current = { onError, onNotice };
  const persistQueue = useRef<Promise<unknown>>(Promise.resolve());
  const remoteQueues = useRef(new Map<string, Promise<unknown>>());
  const selection = useRef(0);
  const hydrationVersion = useRef(0);

  function remember(next: RegistryState) {
    records.current.set(next.id, next);
    if (current.current.id === next.id) {
      current.current = next;
      if (mounted.current) {
        setState(next);
      }
    }
  }
  function activate(next: RegistryState) {
    current.current = next;
    remember(next);
  }
  function enqueuePersistence(action: () => Promise<unknown>): Promise<void> {
    const pending = persistQueue.current
      .catch(() => {})
      .then(action)
      .then(() => {});
    persistQueue.current = pending;
    return pending;
  }
  function persist(value = current.current): Promise<void> {
    if (!ready.current) {
      return Promise.resolve();
    }
    // Resolve by identity when the queued write runs; an older effect must not overwrite new input.
    return enqueuePersistence(() => writeWorkspaceRecord(records.current.get(value.id) ?? value));
  }
  function persistSelection(version: number, id: string): Promise<void> {
    return enqueuePersistence(async () => {
      if (selection.current === version && current.current.id === id) {
        await writeWorkspaceRecord({ id: "registry:active", key: id });
      }
    });
  }
  function runRemote<T>(id: string, action: () => Promise<T>): Promise<T> {
    const pending = (remoteQueues.current.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(action);
    remoteQueues.current.set(id, pending);
    void pending
      .finally(() => {
        if (remoteQueues.current.get(id) === pending) {
          remoteQueues.current.delete(id);
        }
      })
      .catch(() => {});
    return pending;
  }
  function requireReady() {
    if (!ready.current) {
      throw Error("管理情報の読み込みが完了してから操作してください。");
    }
  }
  async function readLatest(branch: string) {
    const snapshot = await request<GitSnapshot>("/snapshot" + query({ branch }));
    const manifest = await request<TaxonomySnapshot>("/manifest" + query({ ...snapshot }));
    if ((manifest as { contractHash?: string }).contractHash !== schema.contractHash) {
      throw Error("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
    }
    return { snapshot, manifest };
  }

  async function retryLoad() {
    if (ready.current) {
      return;
    }
    const version = ++hydrationVersion.current;
    setStatus("読込中");
    try {
      const selected = await readWorkspaceRecord<{ key: string }>("registry:active");
      const key = selected?.key ?? "registry:local";
      const saved =
        (await readWorkspaceRecord<RegistryState>(key)) ??
        (key === "registry:local"
          ? undefined
          : await readWorkspaceRecord<RegistryState>("registry:local"));
      if (mounted.current && hydrationVersion.current === version) {
        activate(saved ?? localState());
        ready.current = true;
        setHydrated(true);
        setStatus("この端末に保存済み");
      }
    } catch {
      if (mounted.current && hydrationVersion.current === version) {
        setHydrated(true);
        setStatus("読込失敗");
        callbacks.current.onError(
          "管理用の下書きを読み込めませんでした。管理画面から再度読み込んでください。",
        );
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    void retryLoad();
    return () => {
      mounted.current = false;
      hydrationVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !ready.current) {
      return;
    }
    let active = true;
    setStatus("保存中…");
    void persist(state)
      .then(() => {
        if (active) {
          setStatus("この端末に保存済み");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("保存失敗");
          callbacks.current.onError("タグ・連載の端末保存に失敗しました。");
        }
      });
    return () => {
      active = false;
    };
  }, [state, hydrated]);

  const preview = useMemo(() => {
    try {
      return {
        manifest: previewRegistryChanges(state.manifest, state.changes),
        reason: state.conflictReason,
      };
    } catch (error) {
      return { manifest: state.manifest, reason: state.conflictReason ?? failureReason(error) };
    }
  }, [state]);
  const issues =
    !ready.current && hydrated
      ? ["管理用の下書きを読み込めていません。再度読み込むまで、管理項目の変更・保存はできません。"]
      : preview.reason
        ? [issueLabel(preview.reason)]
        : [];

  function change(changes: EditorRegistryChanges) {
    requireReady();
    remember(changeRegistryState(current.current, changes));
  }

  function discardChanges(): Promise<void> {
    requireReady();
    // The caller obtains explicit confirmation; subsequent edits are independent of this discard.
    const cleared = withRegistryChanges(current.current, undefined);
    remember(cleared);
    return persist(cleared);
  }

  async function open(prepared: PreparedWorkspace) {
    requireReady();
    const version = ++selection.current;
    const origin = current.current;
    const branch = prepared.snapshot?.branch ?? "";
    const key = "registry:" + (branch || "local");
    await persist(origin);
    return runRemote(key, async () => {
      const saved = records.current.get(key) ?? (await readWorkspaceRecord<RegistryState>(key));
      if (saved && !records.current.has(key)) {
        records.current.set(key, saved);
      }
      let snapshot = prepared.snapshot;
      let manifest = prepared.manifest;
      const known = records.current.get(key);
      // A save may have completed after the caller fetched its prepared snapshot.
      if (snapshot && known?.commit && known.commit !== snapshot.commit) {
        ({ snapshot, manifest } = await readLatest(branch));
      }
      if (selection.current !== version) {
        return;
      }
      const existing = records.current.get(key);
      const source = records.current.get(origin.id) ?? origin;
      const transferred =
        !existing && branch && !source.branch && source.changes ? source : undefined;
      const target = withRegistryChanges(
        {
          ...(existing ?? localState()),
          id: key,
          branch,
          sourceBranch: prepared.sourceBranch,
        },
        existing?.changes ?? transferred?.changes,
      );
      const next = reconcileRegistrySnapshot(
        target,
        snapshot ?? { branch: "", commit: "" },
        manifest,
      );
      activate(next);
      await persist(next);
      await persistSelection(version, key);
      if (transferred && !next.conflictReason) {
        const latestSource = records.current.get(source.id) ?? source;
        const cleared = finishRegistryTransfer(latestSource, transferred);
        remember(cleared);
        await persist(cleared);
        if (cleared === latestSource) {
          callbacks.current.onNotice(
            "移行中に端末用の内容も変更されたため、端末用の変更を残しました。別ブランチへ追加する前に重複を確認してください。",
          );
        }
      }
      if (selection.current === version) {
        if (next.conflictReason) {
          callbacks.current.onError(issueLabel(next.conflictReason));
        } else if (source.id !== key && !source.branch && source.changes && !transferred) {
          callbacks.current.onNotice(
            "このブランチの管理情報を開きました。端末用の変更は別に保存されています。",
          );
        }
      }
    });
  }

  function save() {
    requireReady();
    const id = current.current.id;
    return runRemote(id, async () => {
      const submitted = records.current.get(id)!;
      if (!submitted.branch || !submitted.commit) {
        throw Error("先に作業ブランチを選択してください。");
      }
      if (!submitted.changes) {
        return;
      }
      await persist(submitted);
      try {
        const result = await saveRegistryChanges({
          branch: submitted.branch,
          expectedHead: submitted.commit,
          registryChanges: submitted.changes,
        });
        const saved = acceptRegistrySave(records.current.get(id) ?? submitted, submitted, result);
        remember(saved);
        await persist(saved);
        callbacks.current.onNotice(
          saved.conflictReason
            ? "Gitへ保存しました。保存中の追加変更は手元に残しています。競合箇所を確認してください。"
            : "タグ・分類・連載をGitへ保存しました。",
        );
      } catch (error) {
        if (["GIT_CONFLICT", "SERIES_CONFLICT"].includes(failureReason(error))) {
          const latest = records.current.get(id) ?? submitted;
          const conflicted = withRegistryChanges(latest, latest.changes, failureReason(error));
          remember(conflicted);
          await persist(conflicted);
        }
        throw error;
      }
    });
  }

  function refresh() {
    requireReady();
    const id = current.current.id;
    return runRemote(id, async () => {
      const before = records.current.get(id)!;
      if (!before.branch) {
        return;
      }
      const { snapshot, manifest } = await readLatest(before.branch);
      const next = reconcileRegistrySnapshot(records.current.get(id) ?? before, snapshot, manifest);
      remember(next);
      await persist(next);
      if (current.current.id === id) {
        if (next.conflictReason) {
          callbacks.current.onError(issueLabel(next.conflictReason));
        } else {
          callbacks.current.onNotice(
            "最新の管理情報と照合しました。変更内容を確認して保存してください。",
          );
        }
      }
    });
  }

  function createPR() {
    requireReady();
    const id = current.current.id;
    return runRemote(id, async () => {
      const before = records.current.get(id)!;
      if (before.changes || !before.branch || !before.commit) {
        throw Error("最新の管理情報を先にGitへ保存してください。");
      }
      const pr = await createRegistryPullRequest({
        branch: before.branch,
        base: before.sourceBranch.startsWith("content/") ? "main" : before.sourceBranch,
      });
      const next = { ...(records.current.get(id) ?? before), pr };
      remember(next);
      await persist(next);
    });
  }

  function acceptExternalSave(snapshot: GitSnapshot, manifest: TaxonomySnapshot): Promise<void> {
    // Article saving remains usable if the separate registry draft could not be loaded.
    if (!ready.current || !snapshot.branch) {
      return Promise.resolve();
    }
    const id = "registry:" + snapshot.branch;
    return runRemote(id, async () => {
      const known = records.current.get(id) ?? (await readWorkspaceRecord<RegistryState>(id));
      if (!known) {
        return;
      }
      // Another registry transaction can finish while the article save is returning.
      const latest =
        known.commit !== snapshot.commit
          ? await readLatest(snapshot.branch)
          : { snapshot, manifest };
      const next = reconcileRegistrySnapshot(
        records.current.get(id) ?? known,
        latest.snapshot,
        latest.manifest,
      );
      remember(next);
      await persist(next);
    }).catch(() => {
      callbacks.current.onError(
        "記事のGit保存は完了しました。管理情報の照合は完了していません。接続と端末保存を確認し、管理画面で最新版を取得してください。",
      );
    });
  }

  return {
    state,
    manifest: preview.manifest,
    hydrated,
    status,
    available: ready.current,
    retryLoad,
    conflict: Boolean(preview.reason),
    issues,
    change,
    discardChanges,
    open,
    persist,
    save,
    refresh,
    createPR,
    acceptExternalSave,
  };
}
export type RegistryWorkspace = ReturnType<typeof useRegistryWorkspace>;
