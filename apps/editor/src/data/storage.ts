import type { TaxonomySnapshot } from "@xpotato/editor-core/draft";
import type { ReviewComment } from "@xpotato/editor-core/annotations";
import type { EditorRegistryChanges } from "@xpotato/editor-core/registry";

export interface LocalDraft {
  id: string;
  source: string;
  path: string;
  sourceBranch: string;
  workingBranch: string;
  baseCommit: string;
  baseSource?: string;
  registrySnapshot?: TaxonomySnapshot;
  savedAt: string;
  syncedCommit?: string;
  syncedSource?: string;
  remoteDraftId?: string;
  remoteRevision?: number;
  producer: "human" | "ai" | "mixed";
  annotations?: ReviewComment[] | undefined;
  archived?: boolean;
  pendingRegistryChanges?: EditorRegistryChanges | undefined;
  reviewRevision?: number;
}
export interface LocalMedia {
  id: string;
  draftId: string;
  assetId: string;
  blob: Blob;
  originalBytes: number;
  sourceSha256: string;
  sha256: string;
  kind: "photo" | "technical" | "animation";
  transform: string;
  createdAt: string;
  remoteId?: string;
  originalName: string;
  sourceRetained: boolean;
  alt?: string;
  caption?: string;
  credit?: string;
  creditUrl?: string;
}
export interface DraftRevision {
  id: string;
  draftId: string;
  savedAt: string;
  label: string;
  source: string;
  annotations?: ReviewComment[] | undefined;
  pendingRegistryChanges?: EditorRegistryChanges | undefined;
}

export type LocalDraftBranchBinding = Partial<
  Pick<
    LocalDraft,
    | "workingBranch"
    | "sourceBranch"
    | "baseCommit"
    | "baseSource"
    | "registrySnapshot"
    | "pendingRegistryChanges"
  >
>;

/** A branch copy owns new local and private-media identities, but the same article ContentId. */
export function createLocalDraftBranchCopy(
  original: LocalDraft,
  binding: LocalDraftBranchBinding,
  media: readonly LocalMedia[],
): { draft: LocalDraft; media: LocalMedia[] } {
  if (!binding.workingBranch || !binding.sourceBranch || !binding.baseCommit) {
    throw Error("BRANCH_COPY_TARGET_REQUIRED");
  }
  if (media.some((item) => item.draftId !== original.id)) {
    throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
  }
  const {
    remoteDraftId: _remoteDraftId,
    remoteRevision: _remoteRevision,
    reviewRevision: _reviewRevision,
    syncedCommit: _syncedCommit,
    syncedSource: _syncedSource,
    baseSource: _baseSource,
    registrySnapshot: _registrySnapshot,
    pendingRegistryChanges: _pendingRegistryChanges,
    ...local
  } = structuredClone(original);
  const target = structuredClone(binding);
  const draft: LocalDraft = {
    ...local,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    workingBranch: binding.workingBranch,
    sourceBranch: binding.sourceBranch,
    baseCommit: binding.baseCommit,
    ...(target.baseSource !== undefined ? { baseSource: target.baseSource } : {}),
    ...(target.registrySnapshot ? { registrySnapshot: target.registrySnapshot } : {}),
    ...(target.pendingRegistryChanges
      ? { pendingRegistryChanges: target.pendingRegistryChanges }
      : {}),
  };
  return {
    draft,
    media: media.map((item) => {
      const { remoteId: _remoteId, ...image } = structuredClone(item);
      return { ...image, id: crypto.randomUUID(), draftId: draft.id };
    }),
  };
}

const dbName = "xpotato-editor-v1";
export async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("workspace"))
        db.createObjectStore("workspace", { keyPath: "id" });
      if (!db.objectStoreNames.contains("drafts"))
        db.createObjectStore("drafts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) {
        const media = db.createObjectStore("media", { keyPath: "id" });
        media.createIndex("draftId", "draftId");
      }
      if (!db.objectStoreNames.contains("revisions")) {
        const revisions = db.createObjectStore("revisions", { keyPath: "id" });
        revisions.createIndex("draftId", "draftId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("STORAGE_BLOCKED"));
  });
}
async function transact<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      request = operation(tx.objectStore(store));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? Error("LOCAL_SAVE_FAILED"));
    };
  });
}
let saveQueue: Promise<unknown> = Promise.resolve();
function queueDraftWrite<T>(write: () => Promise<T>): Promise<T> {
  const next = saveQueue.catch(() => {}).then(write);
  saveQueue = next;
  return next;
}
function writeDraftRecord(
  id: string,
  update: (stored: LocalDraft | undefined) => LocalDraft | undefined,
) {
  return queueDraftWrite(() =>
    transact<LocalDraft | undefined>("drafts", "readwrite", (store) => {
      const request = store.get(id);
      request.addEventListener("success", () => {
        const next = update(request.result);
        if (next) store.put(next);
      });
      return request;
    }),
  );
}
export async function saveLocalDraft(draft: LocalDraft): Promise<IDBValidKey> {
  // Another tab may have archived or restored this draft since it was opened here.
  await writeDraftRecord(draft.id, (stored) =>
    stored?.archived === undefined ? draft : { ...draft, archived: stored.archived },
  );
  return draft.id;
}
export async function updateLocalDraftArchive(
  id: string,
  archived: boolean,
  activeDraft?: LocalDraft,
): Promise<void> {
  const stored = await writeDraftRecord(id, (previous) => {
    const draft = activeDraft ?? previous;
    return draft ? { ...draft, archived } : undefined;
  });
  if (!stored && !activeDraft) throw Error("端末に下書きが見つかりません。");
}
export const localDrafts = () => transact<LocalDraft[]>("drafts", "readonly", (s) => s.getAll());
export const readWorkspaceRecord = <T>(id: string) =>
  transact<T | undefined>("workspace", "readonly", (s) => s.get(id));
export const writeWorkspaceRecord = <T extends { id: string }>(value: T) =>
  transact("workspace", "readwrite", (s) => s.put(value));
/** Remove one device-only draft, including its local images and revisions, atomically.
 * Serialize with autosaves so a queued write cannot recreate a deleted draft.
 */
export function deleteLocalDraft(id: string): Promise<void> {
  return queueDraftWrite(async () => {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(["drafts", "media", "revisions"], "readwrite");
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error ?? Error("LOCAL_DRAFT_DELETE_FAILED"));
      };
      tx.objectStore("drafts").delete(id);
      for (const name of ["media", "revisions"] as const) {
        const store = tx.objectStore(name);
        const keys = store.index("draftId").getAllKeys(id);
        keys.onsuccess = () => {
          for (const key of keys.result) store.delete(key);
        };
      }
    });
  });
}
export const saveLocalMedia = (media: LocalMedia) =>
  transact("media", "readwrite", (s) => s.put(media));
export const localMedia = (draftId: string) =>
  transact<LocalMedia[]>("media", "readonly", (s) => s.index("draftId").getAll(draftId));
export const deleteLocalMedia = (id: string) => transact("media", "readwrite", (s) => s.delete(id));
export async function storageEstimate() {
  return navigator.storage?.estimate ? await navigator.storage.estimate() : {};
}

export const localRevisions = (draftId: string) =>
  transact<DraftRevision[]>("revisions", "readonly", (s) => s.index("draftId").getAll(draftId));
export async function saveRevision(draft: LocalDraft, label: string) {
  const previous = (await localRevisions(draft.id)).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  );
  if (
    previous[0]?.source === draft.source &&
    JSON.stringify(previous[0]?.annotations) === JSON.stringify(draft.annotations) &&
    JSON.stringify(previous[0]?.pendingRegistryChanges) ===
      JSON.stringify(draft.pendingRegistryChanges)
  )
    return;
  await transact("revisions", "readwrite", (s) =>
    s.put({
      id: crypto.randomUUID(),
      draftId: draft.id,
      savedAt: new Date().toISOString(),
      label,
      source: draft.source,
      annotations: draft.annotations,
      pendingRegistryChanges: draft.pendingRegistryChanges,
    } satisfies DraftRevision),
  );
  for (const old of previous.slice(39))
    await transact("revisions", "readwrite", (s) => s.delete(old.id));
}

/** Read and update one draft in the same queued transaction, including when it is closed. */
export function updateLocalDraft(
  id: string,
  fallback: LocalDraft,
  update: (latest: LocalDraft) => LocalDraft,
): Promise<LocalDraft> {
  const next = saveQueue
    .catch(() => {})
    .then(async () => {
      const db = await database();
      return new Promise<LocalDraft>((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        const store = tx.objectStore("drafts");
        const read = store.get(id);
        let result: LocalDraft;
        read.onsuccess = () => {
          try {
            result = update((read.result as LocalDraft | undefined) ?? fallback);
            if (result.id !== id) throw Error("DRAFT_ID_MISMATCH");
            store.put(result);
          } catch (error) {
            tx.abort();
            reject(error);
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onabort = tx.onerror = () => {
          db.close();
          reject(tx.error ?? Error("LOCAL_SAVE_FAILED"));
        };
      });
    });
  saveQueue = next;
  return next;
}

/** Commit the new draft and all local images together; leave the original branch untouched. */
export function cloneLocalDraftForBranch(
  draft: LocalDraft,
  binding: LocalDraftBranchBinding,
): Promise<LocalDraft> {
  const original = structuredClone(draft);
  const target = structuredClone(binding);
  const next = saveQueue
    .catch(() => {})
    .then(async () => {
      const db = await database();
      return new Promise<LocalDraft>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(["drafts", "media"], "readwrite");
        } catch (error) {
          db.close();
          reject(error);
          return;
        }
        let copied: LocalDraft;
        let failure: unknown;
        tx.oncomplete = () => {
          db.close();
          resolve(copied);
        };
        tx.onabort = () => {
          db.close();
          reject(failure ?? tx.error ?? Error("LOCAL_SAVE_FAILED"));
        };
        const images = tx.objectStore("media");
        const read = images.index("draftId").getAll(original.id);
        read.onsuccess = () => {
          try {
            const result = createLocalDraftBranchCopy(
              original,
              target,
              read.result as LocalMedia[],
            );
            copied = result.draft;
            tx.objectStore("drafts").add(copied);
            for (const item of result.media) images.add(item);
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      });
    });
  saveQueue = next;
  return next;
}
