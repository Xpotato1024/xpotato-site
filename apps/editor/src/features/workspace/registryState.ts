import type { TaxonomySnapshot } from "@xpotato/editor-core/draft";
import type { GitRegistrySaveResult, GitSnapshot } from "@xpotato/editor-core/git";
import {
  previewRegistryChanges,
  reconcileRegistryChanges,
  remainingRegistryChanges,
  type EditorRegistryChanges,
} from "@xpotato/editor-core/registry";

export interface RegistryState {
  id: string;
  branch: string;
  sourceBranch: string;
  commit: string;
  manifest: TaxonomySnapshot;
  changes?: EditorRegistryChanges;
  pr?: { number: number; url: string };
  conflictReason?: string;
}

const reason = (error: unknown) => (error instanceof Error ? error.message : "REGISTRY_CONFLICT");

export function withRegistryChanges(
  state: RegistryState,
  changes: EditorRegistryChanges | undefined,
  conflictReason?: string,
): RegistryState {
  const { changes: _changes, conflictReason: _conflict, ...rest } = state;
  return {
    ...rest,
    ...(changes ? { changes } : {}),
    ...(conflictReason ? { conflictReason } : {}),
  };
}

export function changeRegistryState(
  state: RegistryState,
  additions: EditorRegistryChanges,
): RegistryState {
  const taxonomy = new Map(
    (state.changes?.taxonomy ?? []).map((term) => [term.namespace + ":" + term.id, term]),
  );
  for (const term of additions.taxonomy ?? []) {
    taxonomy.set(term.namespace + ":" + term.id, term);
  }
  const changes: EditorRegistryChanges = {
    ...state.changes,
    ...additions,
    ...(taxonomy.size ? { taxonomy: [...taxonomy.values()] } : {}),
    ...(additions.series
      ? {
          seriesBase: state.changes?.seriesBase ??
            state.manifest.seriesRegistry ?? { schemaVersion: 1, series: [] },
        }
      : {}),
  };
  previewRegistryChanges(state.manifest, changes);
  const { pr: _pr, ...rest } = state;
  return withRegistryChanges(rest, changes, state.conflictReason);
}

/** Reconcile the latest local edit, including input made while the snapshot was loading. */
export function reconcileRegistrySnapshot(
  state: RegistryState,
  snapshot: GitSnapshot,
  manifest: TaxonomySnapshot,
): RegistryState {
  if (state.branch !== snapshot.branch) {
    throw Error("REGISTRY_CONTEXT_MISMATCH");
  }
  let changes = state.changes;
  try {
    changes = reconcileRegistryChanges(manifest, changes);
    return withRegistryChanges({ ...state, commit: snapshot.commit, manifest }, changes);
  } catch (error) {
    // A failed merge must keep the original base and every pending operation available for review.
    return withRegistryChanges(
      { ...state, commit: snapshot.commit, manifest },
      state.changes,
      reason(error),
    );
  }
}

/** Record the successful commit before persistence, without replacing input entered during saving. */
export function acceptRegistrySave(
  state: RegistryState,
  submitted: RegistryState,
  result: GitRegistrySaveResult,
): RegistryState {
  if (state.id !== submitted.id || state.branch !== result.branch) {
    throw Error("REGISTRY_CONTEXT_MISMATCH");
  }
  let changes = state.changes;
  let conflictReason: string | undefined;
  try {
    changes = remainingRegistryChanges(changes, submitted.changes);
  } catch (error) {
    conflictReason = reason(error);
    // Series conflicts do not make already committed taxonomy additions pending again.
    const taxonomy = remainingRegistryChanges(
      changes?.taxonomy ? { taxonomy: changes.taxonomy } : undefined,
      submitted.changes?.taxonomy ? { taxonomy: submitted.changes.taxonomy } : undefined,
    );
    changes = {
      ...taxonomy,
      ...(changes?.series ? { series: changes.series } : {}),
      ...(changes?.seriesBase ? { seriesBase: changes.seriesBase } : {}),
    };
  }
  try {
    previewRegistryChanges(result.manifest, changes);
  } catch (error) {
    conflictReason ??= reason(error);
  }
  return withRegistryChanges(
    { ...state, commit: result.commit, manifest: result.manifest },
    changes,
    conflictReason,
  );
}

/** Clear a moved offline draft only if no one edited it after the transfer began. */
export function finishRegistryTransfer(
  current: RegistryState,
  transferred: RegistryState,
): RegistryState {
  if (
    current.id !== transferred.id ||
    JSON.stringify(current.changes) !== JSON.stringify(transferred.changes)
  ) {
    return current;
  }
  const { pr: _pr, ...rest } = current;
  return withRegistryChanges(rest, undefined);
}
