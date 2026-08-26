export interface WorkspaceManifest {
  readonly name: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

const dependencyNames = (manifest: WorkspaceManifest): readonly string[] => [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
];

export const validateWorkspaceDependencies = (manifest: WorkspaceManifest): readonly string[] => {
  const dependencies = dependencyNames(manifest);
  const errors: string[] = [];
  if (dependencies.some((name) => name.toLowerCase().includes("pagefind"))) errors.push(`${manifest.name}: Pagefind is rejected`);
  if (manifest.name === "@xpotato/site") {
    for (const denied of ["@xpotato/article-pipeline", "@xpotato/example-verifier", "@xpotato/media-ingest", "ai", "openai"] as const) {
      if (dependencies.some((name) => name === denied || name.startsWith(`${denied}-`))) errors.push(`${manifest.name} must not depend on ${denied}`);
    }
  }
  if (manifest.name === "@xpotato/content-contracts") {
    if (dependencies.some((name) => name === "astro" || name.startsWith("@astrojs/") || name === "openai")) {
      errors.push(`${manifest.name} must remain provider and Astro independent`);
    }
  }
  if (["@xpotato/media-ingest", "@xpotato/example-verifier"].includes(manifest.name)) {
    if (dependencies.some((name) => name === "astro" || name.startsWith("@astrojs/"))) errors.push(`${manifest.name} must not depend on Astro`);
  }
  return errors;
};
