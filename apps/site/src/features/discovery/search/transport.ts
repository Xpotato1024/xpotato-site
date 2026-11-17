import type { AsPlainObject } from "minisearch";

const legacyPostingsFormat = "xpotato-field-tuples-v1";
const postingsFormat = "xpotato-field-tuples-v2";
type FieldTuple = [fieldId: number, ...documentFrequencyPairs: number[]];
type CompactSearchIndexV1 = Omit<AsPlainObject, "index"> & {
  postingsFormat: typeof legacyPostingsFormat;
  index: [term: string, ...fields: FieldTuple[]][];
};
type DocumentPosting = number | [documentId: number, frequency: number];
type CompactFieldTuple = [fieldId: number, ...documents: DocumentPosting[]];
type CompactSearchIndex = Omit<AsPlainObject, "index"> & {
  postingsFormat: typeof postingsFormat;
  index: [term: string, ...fields: CompactFieldTuple[]][];
};

/** Preserve the v1 artifact for already-open clients. */
export const compactSearchIndexV1 = (index: AsPlainObject): CompactSearchIndexV1 => {
  if (index.serializationVersion !== 2) throw new Error("Unsupported MiniSearch serialization version");
  return {
    ...index,
    index: index.index.map(([term, fields]) => [term, ...Object.entries(fields).map(
      ([field, documents]): FieldTuple => [Number(field), ...Object.entries(documents).flatMap(
        ([document, frequency]) => [Number(document), frequency],
      )],
    )]),
    postingsFormat: legacyPostingsFormat,
  };
};

/** A bare document ID means frequency 1; all other frequencies stay explicit. */
export const compactSearchIndex = (index: AsPlainObject): CompactSearchIndex => {
  if (index.serializationVersion !== 2) throw new Error("Unsupported MiniSearch serialization version");
  return {
    ...index,
    index: index.index.map(([term, fields]) => [term, ...Object.entries(fields).map(
      ([field, documents]): CompactFieldTuple => [Number(field), ...Object.entries(documents).map(
        ([document, frequency]): DocumentPosting => frequency === 1 ? Number(document) : [Number(document), frequency],
      )],
    )]),
    postingsFormat,
  };
};

/** Restore the library's native JSON shape; older native artifacts remain readable. */
export const expandSearchIndex = (index: AsPlainObject | CompactSearchIndexV1 | CompactSearchIndex): AsPlainObject => {
  if (!("postingsFormat" in index)) return index;
  if (![legacyPostingsFormat, postingsFormat].includes(index.postingsFormat) || index.serializationVersion !== 2) {
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
      for (const [field, ...postings] of fields) {
        if (!Number.isSafeInteger(field) || field < 0 || Object.hasOwn(expanded, field)) {
          throw new Error("Invalid search field tuple");
        }
        const pairs: DocumentPosting[] = [];
        if (_format === legacyPostingsFormat) {
          if (postings.length % 2 !== 0 || postings.some((value) => typeof value !== "number")) {
            throw new Error("Invalid search field tuple");
          }
          for (let offset = 0; offset < postings.length; offset += 2) {
            pairs.push([postings[offset] as number, postings[offset + 1] as number]);
          }
        } else {
          pairs.push(...postings);
        }
        const documents: Record<string, number> = {};
        for (const posting of pairs) {
          if (typeof posting !== "number" && (!Array.isArray(posting) || posting.length !== 2)) {
            throw new Error("Invalid search document frequency pair");
          }
          const [document, frequency] = typeof posting === "number" ? [posting, 1] : posting;
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
