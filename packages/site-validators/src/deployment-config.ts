import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const parseVnextWranglerConfig = (source: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new Error("vNext Wrangler config must be a JSON object");
  return parsed;
};

export const validateVnextWranglerConfig = (source: string, siteDirectory: string): readonly string[] => {
  const errors: string[] = [];
  let config: Record<string, unknown>;
  try {
    config = parseVnextWranglerConfig(source);
  } catch (error) {
    return [`apps/site/wrangler.jsonc parse failed: ${error instanceof Error ? error.message : String(error)}`];
  }
  const allowedTopLevel = new Set(["name", "compatibility_date", "assets"]);
  for (const key of Object.keys(config)) {
    if (!allowedTopLevel.has(key)) errors.push(`apps/site/wrangler.jsonc contains a forbidden or provider-owned field: ${key}`);
  }
  if (config.name !== "xpotato-site") errors.push("vNext Wrangler service identity must be xpotato-site");
  if (typeof config.compatibility_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(config.compatibility_date)) {
    errors.push("vNext Wrangler compatibility_date must use YYYY-MM-DD");
  } else if (Number.isNaN(Date.parse(`${config.compatibility_date}T00:00:00Z`))) {
    errors.push("vNext Wrangler compatibility_date is invalid");
  }
  if (!isRecord(config.assets)) {
    errors.push("vNext Wrangler assets config is required");
    return errors;
  }
  const allowedAssetFields = new Set(["directory", "not_found_handling"]);
  for (const key of Object.keys(config.assets)) {
    if (!allowedAssetFields.has(key)) errors.push(`vNext Wrangler assets contains an unexpected field: ${key}`);
  }
  if (config.assets.directory !== "./dist") errors.push("vNext Wrangler assets.directory must be ./dist");
  else if (resolve(siteDirectory, config.assets.directory) !== resolve(siteDirectory, "dist")) {
    errors.push("vNext Wrangler assets.directory does not resolve to apps/site/dist");
  }
  if (config.assets.not_found_handling !== "404-page") {
    errors.push("vNext Wrangler assets.not_found_handling must be 404-page");
  }
  return errors;
};

export const validateBlockedDeployWorkflow = (source: string): readonly string[] => {
  const errors: string[] = [];
  let workflow: unknown;
  try {
    workflow = parseYaml(source);
  } catch (error) {
    return [`deploy-site.yml parse failed: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (!isRecord(workflow)) return ["deploy-site.yml must parse to an object"];
  const env = workflow.env;
  if (!isRecord(env) || env.VNEXT_WRANGLER_CONFIG !== "apps/site/wrangler.jsonc") {
    errors.push("deploy-site.yml must declare apps/site/wrangler.jsonc as the vNext deploy authority");
  }
  const jobs = workflow.jobs;
  const lifecycleGate = isRecord(jobs) ? jobs["lifecycle-gate"] : undefined;
  if (!isRecord(lifecycleGate) || lifecycleGate.if !== "${{ false }}") {
    errors.push("deploy-site.yml lifecycle-gate must remain hard blocked with if: ${{ false }}");
  }
  if (isRecord(jobs)) {
    for (const job of Object.values(jobs)) {
      if (!isRecord(job) || !Array.isArray(job.steps)) continue;
      for (const step of job.steps) {
        if (isRecord(step) && typeof step.run === "string" && /\b(?:npx\s+)?wrangler\s+(?:deploy|publish)\b/iu.test(step.run)) {
          errors.push("blocked deploy-site.yml must not contain an executable Wrangler deploy command");
        }
      }
    }
  }
  return errors;
};
