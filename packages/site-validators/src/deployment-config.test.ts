import { describe, expect, it } from "vitest";
import { validateBlockedDeployWorkflow, validateVnextWranglerConfig } from "./deployment-config.js";

const siteDirectory = "/repository/apps/site";
const validConfig = JSON.stringify({
  name: "xpotato-site",
  compatibility_date: "2026-08-26",
  assets: { directory: "./dist", not_found_handling: "404-page" },
});
const validWorkflow = `name: blocked
env:
  VNEXT_WRANGLER_CONFIG: apps/site/wrangler.jsonc
jobs:
  lifecycle-gate:
    if: \${{ false }}
    runs-on: ubuntu-latest
    steps:
      - run: echo blocked
`;

describe("vNext application-local deployment authority", () => {
  it("accepts a minimal static-assets config and a hard-blocked workflow", () => {
    expect(validateVnextWranglerConfig(validConfig, siteDirectory)).toEqual([]);
    expect(validateBlockedDeployWorkflow(validWorkflow)).toEqual([]);
  });

  it.each([
    ["wrong assets directory", { assets: { directory: "../../dist", not_found_handling: "404-page" } }],
    ["wrong 404 behavior", { assets: { directory: "./dist", not_found_handling: "single-page-application" } }],
    ["account ID", { account_id: "provider-account" }],
    ["zone ID", { zone_id: "provider-zone" }],
    ["production routes", { routes: [{ pattern: "xpotato.net", custom_domain: true }] }],
    ["R2 bindings", { r2_buckets: [{ binding: "MEDIA", bucket_name: "actual-bucket" }] }],
  ])("rejects %s in the site-owned config", (_label, change) => {
    const config = { ...JSON.parse(validConfig), ...change };
    expect(validateVnextWranglerConfig(JSON.stringify(config), siteDirectory)).not.toEqual([]);
  });

  it("rejects malformed JSONC rather than guessing through it", () => {
    expect(validateVnextWranglerConfig("{ invalid", siteDirectory).join("\n")).toMatch(/parse failed/);
  });

  it.each([
    ["opened gate", validWorkflow.replace("if: ${{ false }}", "if: ${{ true }}")],
    ["legacy root authority", validWorkflow.replace("apps/site/wrangler.jsonc", "wrangler.jsonc")],
    ["deploy command", validWorkflow.replace("- run: echo blocked", "- run: wrangler deploy")],
  ])("rejects a workflow with %s", (_label, workflow) => {
    expect(validateBlockedDeployWorkflow(workflow)).not.toEqual([]);
  });
});
