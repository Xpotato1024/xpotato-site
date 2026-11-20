import { describe, expect, it } from "vitest";
import { taxonomyRegistrySchema } from "@xpotato/content-contracts/content";
import type { SeriesRegistry } from "@xpotato/content-contracts/series";
import {
  previewRegistryChanges,
  taxonomySnapshotFields,
  type TaxonomyAddition,
} from "@xpotato/editor-core/registry";
import {
  acceptRegistrySave,
  changeRegistryState,
  finishRegistryTransfer,
  reconcileRegistrySnapshot,
  withRegistryChanges,
  type RegistryState,
} from "./registryState.js";

const empty: SeriesRegistry = { schemaVersion: 1, series: [] };
const course = (title = "入門", id = "course"): SeriesRegistry => ({
  schemaVersion: 1,
  series: [
    { id, slug: id, title, description: "", kind: "course", status: "ongoing", entries: [] },
  ],
});
const first: TaxonomyAddition = { namespace: "tags", id: "first", label: "最初", kind: "topic" };
const second: TaxonomyAddition = {
  namespace: "tags",
  id: "second",
  label: "追加",
  kind: "purpose",
};
const base = (): RegistryState => ({
  id: "registry:content/organize",
  branch: "content/organize",
  sourceBranch: "main",
  commit: "a".repeat(40),
  manifest: {
    contractVersion: 1,
    modules: [],
    seriesRegistry: empty,
    ...taxonomySnapshotFields(
      taxonomyRegistrySchema.parse({
        schemaVersion: 1,
        blogCategories: [],
        noteSubjects: [],
        toolCategories: [],
        tags: [],
      }),
    ),
  },
});
const result = (submitted: RegistryState) => ({
  branch: submitted.branch,
  commit: "b".repeat(40),
  manifest: previewRegistryChanges(submitted.manifest, submitted.changes),
});

describe("registry workspace state across asynchronous operations", () => {
  it("discards only pending operations while keeping the branch, committed head, and Git definitions intact", () => {
    const pending = {
      ...changeRegistryState(base(), { taxonomy: [first], series: course() }),
      conflictReason: "SERIES_CONFLICT",
    };
    const cleared = withRegistryChanges(pending, undefined);
    expect(cleared.id).toBe(pending.id);
    expect(cleared.branch).toBe(pending.branch);
    expect(cleared.commit).toBe(pending.commit);
    expect(cleared.manifest).toBe(pending.manifest);
    expect(Object.hasOwn(cleared, "changes")).toBe(false);
    expect(Object.hasOwn(cleared, "conflictReason")).toBe(false);
    expect(pending.changes?.taxonomy).toEqual([first]);
  });
  it("records the committed head while retaining taxonomy and series edits entered during saving", () => {
    const submitted = changeRegistryState(base(), { taxonomy: [first], series: course() });
    const latest = changeRegistryState(submitted, {
      taxonomy: [second],
      series: course("続けて編集"),
    });
    const next = acceptRegistrySave(latest, submitted, result(submitted));
    expect(next.commit).toBe("b".repeat(40));
    expect(next.changes).toEqual({
      taxonomy: [second],
      series: course("続けて編集"),
      seriesBase: course(),
    });
    expect(next.conflictReason).toBeUndefined();
    expect(previewRegistryChanges(next.manifest, next.changes).tags).toEqual(["first", "second"]);
    const afterward = changeRegistryState(next, {
      taxonomy: [{ ...second, id: "third", label: "保存待ち中の追記" }],
    });
    expect(afterward.changes?.taxonomy?.map((term) => term.id)).toEqual(["second", "third"]);
    expect(afterward.commit).toBe(next.commit);
  });

  it("keeps a changed pending definition visible as a conflict instead of silently acknowledging its matching ID", () => {
    const submitted = changeRegistryState(base(), { taxonomy: [first] });
    const changed = { ...first, label: "保存中に名前を変更" };
    const latest = changeRegistryState(submitted, { taxonomy: [changed] });
    const next = acceptRegistrySave(latest, submitted, result(submitted));
    expect(next.changes?.taxonomy).toEqual([changed]);
    expect(next.conflictReason).toContain("TAXONOMY_ID_EXISTS");
    expect(next.commit).toBe("b".repeat(40));
    expect(next.manifest.tags).toEqual(["first"]);
  });

  it("retains conflicting series after a successful save without resurrecting committed taxonomy additions", () => {
    const latest = changeRegistryState(base(), {
      taxonomy: [first, second],
      series: course("手元の編集"),
    });
    const submitted = withRegistryChanges(base(), {
      taxonomy: [first],
      seriesBase: course("別の変更"),
      series: course("別の変更"),
    });
    const next = acceptRegistrySave(latest, submitted, result(submitted));
    expect(next.changes?.taxonomy).toEqual([second]);
    expect(next.changes?.series).toEqual(latest.changes?.series);
    expect(next.changes?.seriesBase).toEqual(empty);
    expect(next.conflictReason).toBe("SERIES_CONFLICT");
    expect(next.commit).toBe("b".repeat(40));
  });

  it("reconciles the latest pending state with an independently edited remote series", () => {
    const before = changeRegistryState(base(), { taxonomy: [first], series: course() });
    const latest = changeRegistryState(before, { taxonomy: [second] });
    const remote = { ...base().manifest, seriesRegistry: course("別の連載", "other") };
    const next = reconcileRegistrySnapshot(
      latest,
      { branch: latest.branch, commit: "c".repeat(40) },
      remote,
    );
    expect(next.changes?.taxonomy).toEqual([first, second]);
    expect(next.changes?.series?.series.map((series) => series.id)).toEqual(["other", "course"]);
    expect(next.changes?.seriesBase).toEqual(remote.seriesRegistry);
    expect(next.conflictReason).toBeUndefined();
  });

  it("retains all pending operations and their observed base when a refreshed series conflicts", () => {
    const latest = changeRegistryState(base(), { taxonomy: [first], series: course("手元") });
    const remote = { ...base().manifest, seriesRegistry: course("Git側") };
    const next = reconcileRegistrySnapshot(
      latest,
      { branch: latest.branch, commit: "c".repeat(40) },
      remote,
    );
    expect(next.changes).toBe(latest.changes);
    expect(next.manifest).toBe(remote);
    expect(next.commit).toBe("c".repeat(40));
    expect(next.conflictReason).toBe("SERIES_CONFLICT");
  });

  it("acknowledges identical externally saved definitions without leaving optional fields set to undefined", () => {
    const latest = changeRegistryState(
      { ...base(), pr: { number: 1, url: "https://example.test/1" } },
      { taxonomy: [first], series: course() },
    );
    expect(Object.hasOwn(latest, "pr")).toBe(false);
    const saved = result(latest);
    const next = reconcileRegistrySnapshot(latest, saved, saved.manifest);
    expect(Object.hasOwn(next, "changes")).toBe(false);
    expect(Object.hasOwn(next, "conflictReason")).toBe(false);
  });

  it("clears an offline draft only after the same content was transferred, keeping intervening input", () => {
    const moved = changeRegistryState(
      { ...base(), id: "registry:local", branch: "", commit: "" },
      { taxonomy: [first] },
    );
    expect(finishRegistryTransfer(moved, moved).changes).toBeUndefined();
    const edited = changeRegistryState(moved, { taxonomy: [second] });
    expect(finishRegistryTransfer(edited, moved)).toBe(edited);
    expect(finishRegistryTransfer(base(), moved)).toEqual(base());
  });

  it("refuses to apply a response from another branch to this workspace", () => {
    expect(() =>
      reconcileRegistrySnapshot(
        base(),
        { branch: "content/other", commit: "b".repeat(40) },
        base().manifest,
      ),
    ).toThrow("REGISTRY_CONTEXT_MISMATCH");
    expect(() =>
      acceptRegistrySave(base(), base(), { ...result(base()), branch: "content/other" }),
    ).toThrow("REGISTRY_CONTEXT_MISMATCH");
  });
});
