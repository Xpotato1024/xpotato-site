import articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c from "./blog/09e6785f-6da5-4c2f-892b-e573845f0e9c.json";
import articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8 from "./blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json";
export interface ProvenanceRegistryEntry {
  readonly contentId: string;
  readonly provenanceSha256: string;
}

export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([{contentId:articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c.contentId,provenanceSha256:"e60ff83fd8cc0bb02d50e8bb45f829d819af6a2cdffca121fad390327b0b1c2d"},{contentId:articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8.contentId,provenanceSha256:"28f17d53c97d0433d1ab408636a46a9ca218c31efa9f5cc104a28852db5e3487"},]);
export const publicationProvenanceRecords = Object.freeze({[articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c.contentId]:articleProvenance_09e6785f_6da5_4c2f_892b_e573845f0e9c,[articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8.contentId]:articleProvenance_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8,});
