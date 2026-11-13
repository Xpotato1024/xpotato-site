import articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c from "./blog/09e6785f-6da5-4c2f-892b-e573845f0e9c.json";
import articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8 from "./blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json";
export interface ProvenanceRegistryEntry {
  readonly contentId: string;
  readonly provenanceSha256: string;
}

export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([{contentId:articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c.contentId,provenanceSha256:"8dd915e5bfae6f1143560c364bf660cfc3c43fbac5acc59792d928e6cc63e385"},{contentId:articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8.contentId,provenanceSha256:"b4df9534db5e7628aa28df851952c801265fde89c567414e656745d45ce7c71a"},]);
