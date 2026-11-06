import { interactiveModuleRegistry, toolBindings } from "../content-registry/interactive/index.js";
import { browserToolReleases } from "../content-registry/interactive/releases.js";
import { selectWebIndexableCatalog, type DerivedCatalogEntry } from "./discovery/catalog.js";

/** Public destinations only. Never append tool inputs, results or browsing queries. */
export const contactEmail = "321miyuto@xpotato.net";
export const siteIssueUrl = "https://github.com/Xpotato1024/xpotato-site/issues/new";

// Repository capability, not a second tool catalog. Confirm has_issues and /issues/new
// before admitting another source. A GitHub source alone does not imply Issues support.
const confirmedIssueRepositories = new Set(["https://github.com/Xpotato1024/browser-prime-toolkit"]);
type Module = { id: string; status: string; role: string; releaseId?: string | undefined };
type Binding = { contentId: string; moduleId: string; status: string; role: string };
type Release = { toolId: string; releaseId: string; source: { kind: string; repository?: string | undefined } };
type Registry = { modules: Readonly<Record<string, Module>>; bindings: readonly Binding[]; releases: readonly Release[] };
const registry: Registry = { modules: interactiveModuleRegistry, bindings: toolBindings, releases: browserToolReleases };

export function getToolIssueLink(toolId: string | undefined, records: Registry = registry) {
  const module = toolId ? records.modules[toolId] : undefined;
  if (!module || module.status !== "active" || module.role !== "primary_tool") return undefined;
  const pin = records.releases.find(release => release.toolId === module.id && release.releaseId === module.releaseId);
  if (!pin || pin.source.kind !== "github" || !pin.source.repository || !confirmedIssueRepositories.has(pin.source.repository)) return undefined;
  return { href: `${pin.source.repository}/issues/new` };
}

/** Titles/publication come from /tools/' catalog; identity/source from the installer registry. */
export function deriveContactTargets(catalog: readonly DerivedCatalogEntry[], records: Registry = registry) {
  return [
    { id: "site", label: "このサイトの表示・動作", href: siteIssueUrl, issue: true },
    ...selectWebIndexableCatalog(catalog).filter(entry => entry.source.collection === "tools")
      .sort((a, b) => a.discoveryRecord.title.localeCompare(b.discoveryRecord.title, "ja") || a.discoveryRecord.contentId.localeCompare(b.discoveryRecord.contentId))
      .map(entry => {
        const bindings = records.bindings.filter(binding => binding.contentId === entry.discoveryRecord.contentId && binding.status === "active" && binding.role === "primary_tool");
        const issue = bindings.length === 1 ? getToolIssueLink(bindings[0]!.moduleId, records) : undefined;
        return { id: entry.discoveryRecord.contentId, label: entry.discoveryRecord.title, href: issue?.href ?? `mailto:${contactEmail}`, issue: Boolean(issue) };
      }),
  ];
}
