export type PublicationFixtureMode = "prepare" | "prepare-isolation-only" | "check";

// The bounded mode retains the real candidate, mock persistence/export, cleanup
// render and approval-invalidation checks. Only the five update lifecycles move
// to a separately required source-validation job. Local preparation stays full.
export function publicationFixtureMode(args: readonly string[]): PublicationFixtureMode {
  if (args.length === 0) return "prepare";
  if (args.length === 1) {
    if (args[0] === "--prepare") return "prepare";
    if (args[0] === "--prepare-isolation-only") return "prepare-isolation-only";
    if (args[0] === "--check") return "check";
  }
  throw new Error("Expected --prepare, --prepare-isolation-only or --check");
}

const allUpdateKinds = ["body", "title", "hero", "category", "tags"] as const;

export function publicationFixtureUpdateKinds(mode: PublicationFixtureMode) {
  if (mode === "prepare") return allUpdateKinds;
  if (mode === "prepare-isolation-only") return [] as const;
  throw new Error("Publication check cannot prepare update fixtures");
}
