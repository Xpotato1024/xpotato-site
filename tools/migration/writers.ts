// Explicit migration writes. Validators retain shared regeneration and read-only checks.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Phase4ContentMaterializationManifest,Phase5TaxonomyRawInventory,Phase5TaxonomyMaterializationManifest,Phase6MediaRawInventory,Phase6MediaReviewProposal,Phase6MediaRepositoryCandidateManifest,Phase7InteractiveReadinessManifest} from '@xpotato/content-contracts';
import { buildExpectedPhase4Materialization, materializationManifestPath } from '../../packages/site-validators/src/phase4-content-materialization.js';
import { buildPhase5TaxonomyRawInventory, phase5TaxonomyRawInventoryPath } from '../../packages/site-validators/src/phase5-taxonomy-inventory.js';
import { buildExpectedPhase5TaxonomyMaterialization, taxonomyDataPath, taxonomyIndexPath, phase5ManifestPath } from '../../packages/site-validators/src/phase5-taxonomy-materialization.js';
import { buildPhase6MediaRawInventory, phase6MediaRawInventoryPath } from '../../packages/site-validators/src/phase6-media-inventory.js';
import { buildPhase6MediaReviewProposal, phase6MediaReviewProposalPath } from '../../packages/site-validators/src/phase6-media-review.js';
import { buildPhase6MediaRepositoryCandidate, phase6MediaRepositoryCandidatePath, phase6DeterministicSourceRoot, keyOf } from '../../packages/site-validators/src/phase6-media-candidate.js';
import { buildPhase7InteractiveReadiness, phase7InteractiveReadinessPath } from '../../packages/site-validators/src/phase7-interactive-readiness.js';
import { buildPhase8Readiness, phase8ManifestPath } from '../../packages/site-validators/src/phase8-route-discovery-readiness.js';
const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const readJson=async (p:string):Promise<unknown>=>JSON.parse(await readFile(p,'utf8')) as unknown;

export const writePhase4Materialization = async (): Promise<Phase4ContentMaterializationManifest> => {
  const expected = await buildExpectedPhase4Materialization();
  for (const [repositoryPath, source] of expected.files) {
    const path = join(repositoryRoot, repositoryPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, "utf8");
  }
  await writeFile(materializationManifestPath, `${JSON.stringify(expected.manifest, null, 2)}\n`, "utf8");
  return expected.manifest;
};

export const writePhase5TaxonomyRawInventory = async (): Promise<Phase5TaxonomyRawInventory> => {
  const inventory = await buildPhase5TaxonomyRawInventory();
  await writeFile(phase5TaxonomyRawInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
};

export const writePhase5TaxonomyMaterialization = async (): Promise<Phase5TaxonomyMaterializationManifest> => {
  const ledger = await readJson(join(repositoryRoot, "docs/content/manual-editorial-revisions-v1.json")) as { revisions?: unknown[] };
  if (ledger.revisions?.length) throw new Error("Do not overwrite manual revisions; materialize the frozen baseline only in an isolated evidence checkout");
  const expected = await buildExpectedPhase5TaxonomyMaterialization();
  for (const [repositoryPath, source] of expected.files) {
    const path = join(repositoryRoot, repositoryPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, "utf8");
  }
  await mkdir(dirname(taxonomyDataPath), { recursive: true });
  await writeFile(taxonomyDataPath, expected.taxonomyDataSource, "utf8");
  await writeFile(taxonomyIndexPath, expected.taxonomyIndexSource, "utf8");
  await writeFile(phase5ManifestPath, `${JSON.stringify(expected.manifest, null, 2)}\n`, "utf8");
  return expected.manifest;
};

export const writePhase6MediaRawInventory = async (): Promise<Phase6MediaRawInventory> => {
  const inventory = await buildPhase6MediaRawInventory();
  await writeFile(phase6MediaRawInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
};

export const writePhase6MediaReviewProposal = async (): Promise<Phase6MediaReviewProposal> => {
  const proposal = await buildPhase6MediaReviewProposal();
  await writeFile(phase6MediaReviewProposalPath, `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  return proposal;
};

export const writePhase6MediaRepositoryCandidate = async (emitSources = false): Promise<Phase6MediaRepositoryCandidateManifest> => {
  const result = await buildPhase6MediaRepositoryCandidate();
  await writeFile(phase6MediaRepositoryCandidatePath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");
  if (emitSources) {
    for (const record of result.manifest.deterministicSources) {
      const source = result.deterministicSourceBytes.get(keyOf(record.contentId, record.assetId));
      if (!source) throw new Error(`Deterministic source bytes missing for ${record.contentId}/${record.assetId}`);
      const file = join(phase6DeterministicSourceRoot, record.contentId, `${record.assetId}.svg`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, source, "utf8");
    }
  }
  return result.manifest;
};

export const writePhase7InteractiveReadiness = async (): Promise<Phase7InteractiveReadinessManifest> => {
  const manifest = await buildPhase7InteractiveReadiness();
  await writeFile(phase7InteractiveReadinessPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};

export const writePhase8Readiness = async () => {
  const manifest = await buildPhase8Readiness({ includeHeldPreview: true });
  await writeFile(phase8ManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};
