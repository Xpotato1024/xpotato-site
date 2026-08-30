import {
  checkPhase6MediaRawInventory,
  writePhase6MediaRawInventory,
} from "./phase6-media-inventory.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");

const inventory = writeMode
  ? await writePhase6MediaRawInventory()
  : await checkPhase6MediaRawInventory();

console.log(
  `Phase 6 media raw inventory PASS: pendingContent=${inventory.mediaPendingContentCount}; locators=${inventory.uniqueLocatorCount}; gitVerified=${inventory.gitVerifiedLocatorCount}; unresolved=${inventory.unresolvedLocatorCount}; manifest=${inventory.manifestPayloadSha256}`,
);
