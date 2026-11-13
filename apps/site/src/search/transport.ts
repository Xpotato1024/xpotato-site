import type { AsPlainObject } from "minisearch";

const postingsFormat = "xpotato-field-tuples-v1";
type FieldTuple = [fieldId: number, ...documentFrequencyPairs: number[]];
type CompactSearchIndex = Omit<AsPlainObject, "index"> & {
  postingsFormat: typeof postingsFormat;
  index: [term: string, ...fields: FieldTuple[]][];
};

/** Only wire punctuation changes: every term, field, document and frequency survives. */
export const compactSearchIndex = (index: AsPlainObject): CompactSearchIndex => {
  if (index.serializationVersion !== 2) throw new Error("Unsupported MiniSearch serialization version");
  return {
    ...index,
    index: index.index.map(([term, fields]) => [term, ...Object.entries(fields).map(
      ([field, documents]): FieldTuple => [Number(field), ...Object.entries(documents).flatMap(
        ([document, frequency]) => [Number(document), frequency],
      )],
    )]),
    postingsFormat,
  };
};

/** Restore the library's native JSON shape; older native artifacts remain readable. */
export const expandSearchIndex = (index: AsPlainObject | CompactSearchIndex): AsPlainObject => {
  if (!("postingsFormat" in index)) return index;
  if (index.postingsFormat !== postingsFormat || index.serializationVersion !== 2) {
    throw new Error("Unsupported search postings format");
  }
  const { postingsFormat: _format, ...native } = index;
  const seenTerms = new Set<string>();
  return {
    ...native,
    index: native.index.map(([term, ...fields]) => {
      if (typeof term !== "string" || seenTerms.has(term)) throw new Error("Invalid search term tuple");
      seenTerms.add(term);
      const expanded: AsPlainObject["index"][number][1] = {};
      for (const [field, ...pairs] of fields) {
        if (!Number.isSafeInteger(field) || field < 0 || pairs.length % 2 !== 0 || Object.hasOwn(expanded, field)) {
          throw new Error("Invalid search field tuple");
        }
        const documents: Record<string, number> = {};
        for (let offset = 0; offset < pairs.length; offset += 2) {
          const document = pairs[offset]!;
          const frequency = pairs[offset + 1]!;
          if (!Number.isSafeInteger(document) || document < 0 || !Number.isSafeInteger(frequency) || frequency <= 0 || Object.hasOwn(documents, document)) {
            throw new Error("Invalid search document frequency pair");
          }
          documents[document] = frequency;
        }
        expanded[field] = documents;
      }
      return [term, expanded];
    }),
  };
};
