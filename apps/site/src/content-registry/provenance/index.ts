import articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c from "./blog/09e6785f-6da5-4c2f-892b-e573845f0e9c.json";
import articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8 from "./blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json";
export interface ProvenanceRegistryEntry {
  readonly contentId: string;
  readonly provenanceSha256: string;
}

export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([{contentId:articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c.contentId,provenanceSha256:"d8a23a820075f25f48d5ea47ee6abbac04220cb18716d0b6e0e57679746ed590"},{contentId:articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8.contentId,provenanceSha256:"24cfc39b143d887fdea8014b7906941e3afe575e49bd0106eb5e122220109858"},]);
export const publicationProvenanceRecords = Object.freeze({[articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c.contentId]:articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c,[articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8.contentId]:articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8,});
