export interface ProvenanceRegistryEntry {
  readonly contentId: string;
  readonly provenanceSha256: string;
}

export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([]);
