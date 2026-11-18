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
const dbName = "xpotato-editor-v1";
export async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
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
export const saveLocalDraft = (draft: LocalDraft): Promise<IDBValidKey> => {
  const next = saveQueue
    .catch(() => {})
    .then(() => transact("drafts", "readwrite", (s) => s.put(draft)));
  saveQueue = next;
  return next;
};
export const localDrafts = () => transact<LocalDraft[]>("drafts", "readonly", (s) => s.getAll());
export const deleteLocalDraft = (id: string) =>
  transact("drafts", "readwrite", (s) => s.delete(id));
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
