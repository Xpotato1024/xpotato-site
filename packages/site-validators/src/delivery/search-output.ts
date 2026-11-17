import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "@xpotato/content-contracts/canonical";
import { searchIndexPath } from "../../../../apps/site/src/features/discovery/search/index-path.mjs";
import { loadSearchIndex } from "../../../../apps/site/src/features/discovery/search/runtime.js";

/** Reports the exact generated search index plus separate synthetic tokenizer/exclusion regression evidence. */
export const readSearchOutput = async (
  distRoot: string,
): Promise<{
  index: {
    sha256: string;
    documentCount: number;
    documents: { id: string; route: string; title: string; collection: string }[];
  };
}> => {
  const indexPath = join(distRoot, searchIndexPath.slice(1));
  const bytes = await readFile(indexPath);
  const serialized = bytes.toString("utf8");
  const raw = JSON.parse(serialized) as { documentCount?: unknown; documentIds?: unknown };
  assert.ok(
    raw.documentIds && typeof raw.documentIds === "object" && !Array.isArray(raw.documentIds),
    "Serialized search index must contain a documentIds object",
  );
  const ids = Object.values(raw.documentIds as Record<string, unknown>);
  assert.ok(
    ids.every((id): id is string => typeof id === "string"),
    "Serialized search document IDs must be strings",
  );
  assert.equal(new Set(ids).size, ids.length, "Serialized search document IDs must be unique");

  const index = loadSearchIndex(serialized);
  assert.equal(
    index.documentCount,
    ids.length,
    "Loaded search index document count must match serialized IDs",
  );
  const documents = ids
    .map((id) => {
      const fields = index.getStoredFields(id);
      assert.ok(fields, `Search index is missing stored fields for ${id}`);
      assert.equal(typeof fields.route, "string", `Search index route must be stored for ${id}`);
      assert.equal(typeof fields.title, "string", `Search index title must be stored for ${id}`);
      assert.equal(
        typeof fields.collection,
        "string",
        `Search index collection must be stored for ${id}`,
      );
      return {
        id,
        route: fields.route as string,
        title: fields.title as string,
        collection: fields.collection as string,
      };
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  return {
    index: { sha256: sha256(bytes), documentCount: ids.length, documents },
  };
};
