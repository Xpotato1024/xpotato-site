import { applicationBuildScripts, runApplicationBuilds } from "../build/apps-graph.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertManualWorkflow } from "../deployment/manual-deployment-workflow-policy.mjs";
import { sourceLanes } from "./ci-source.mjs";
import { producerPhases } from "./producer-parallel.mjs";
const scripts = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url))).scripts;
function expanded(name, ancestors = []) {
  assert.ok(!ancestors.includes(name), `Cycle: ${name}`);
  return scripts[name].split(" && ").flatMap((cmd) => {
    if (cmd === "node ops/build/apps.mjs")
      return applicationBuildScripts.flatMap((script) => expanded(script, [...ancestors, name]));
    if (cmd === "node ops/ci/ci-source.mjs")
      return sourceLanes.flatMap((lane) => expanded(lane, [...ancestors, name]));
    for (const phase of Object.keys(producerPhases)) {
      if (cmd === "node ops/ci/producer-parallel.mjs " + phase) {
        return producerPhases[phase].flatMap((lane) => expanded(lane, [...ancestors, name]));
      }
    }
    const match = /^npm run ([\w:-]+)$/.exec(cmd);
    return match ? expanded(match[1], [...ancestors, name]) : [cmd];
  });
}
test("core DAG builds once before final consumers, packaging never rebuilds", () => {
  const graph = expanded("release:produce");
  assert.equal(graph.filter((c) => c === "npm run build --workspace @xpotato/site").length, 1);
  assert.equal(graph.filter((c) => c.includes("static")).length, 1);
  assert.equal(graph.filter((c) => c === "tsx ops/build/publication.ts").length, 1);
  assert.equal(graph.filter((c) => c === "tsx ops/build/publication.ts --check").length, 1);
  assert.ok(
    graph.indexOf("tsx ops/build/publication.ts --check") >
      graph.indexOf("tsx ops/build/publication.ts"),
  );
  assert.ok(
    !graph.some((c) => c.includes("security-headers-cli.ts --write")),
    "CSP is generated in the publication compiler, not a second writer",
  );
  assert.equal(graph.filter((c) => c === "tsx ops/qa/performance-budget.mjs").length, 1);
  assert.ok(
    graph.indexOf("tsx ops/qa/performance-budget.mjs") >
      graph.indexOf("npm run build --workspace @xpotato/site"),
  );
  assert.ok(!graph.some((c) => /canonicaliz|artifact-manifest|phase8-preview/.test(c)));
  for (const name of ["release:package", "tools:readiness", "site:output:check"])
    assert.ok(!expanded(name).some((c) => /astro build|npm run build/.test(c)), name);
});
test("production dispatch remains manual/main/owner-only", () => {
  assertManualWorkflow(
    readFileSync(new URL("../../.github/workflows/deploy-site.yml", import.meta.url), "utf8"),
  );
});

test("both preparation lanes finish before the parallel final consumers and packaging", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const producer = workflow.split("  producer:")[1].split("  windows-consumer:")[0];
  const prepare = producer.indexOf("run: npm run ci:producer:prepare");
  const validate = producer.indexOf("run: npm run ci:producer:validate");
  const gate = producer.indexOf("run: npm run ci:hosted:gate");
  const pack = producer.indexOf("run: npm run release:package");
  assert.ok(prepare >= 0 && prepare < validate && validate < gate && gate < pack);
  assert.deepEqual(producerPhases.prepare, ["release:build:hosted", "ci:browsers:prepare"]);
  assert.deepEqual(producerPhases.validate, ["quality:home-webkit:hosted", "ci:final:public"]);
  assert.equal(
    scripts["ci:browsers:prepare"],
    "npm run toolchain:check && npx --no-install playwright install --with-deps webkit && node ops/ci/prepare-chrome-font-cache.mjs",
  );
  assert.equal(
    scripts["quality:home-webkit:hosted"],
    'npm run quality:home-webkit -- --dist "$GITHUB_WORKSPACE/apps/site/dist" --out "$RUNNER_TEMP/release-validation"',
  );
  const preparation = expanded("ci:producer:prepare"),
    validation = expanded("ci:producer:validate");
  assert.equal(
    preparation.filter((c) => c === "npm run build --workspace @xpotato/site").length,
    1,
  );
  assert.equal(
    preparation.filter((c) => c === "npm run build --workspace @xpotato/editor").length,
    1,
  );
  assert.ok(!validation.some((c) => /astro build|npm run build/u.test(c)));
  assert.deepEqual(validation.slice(1), expanded("ci:final:public"));
  assert.ok(
    ![...preparation, ...validation].some((c) => /ci-hosted-gate|release-package-cli/u.test(c)),
  );
  assert.equal(
    scripts["release:validate:hosted"],
    "npm run release:build:hosted && npm run ci:final:public",
  );
  const steps = producer.split(/\n      - /u);
  const preparationStep = steps.find((step) => step.includes("run: npm run ci:producer:prepare"));
  const validationStep = steps.find((step) => step.includes("run: npm run ci:producer:validate"));
  assert.ok(preparationStep && validationStep && preparationStep !== validationStep);
  assert.equal((producer.match(/run: npm run ci:producer:prepare/g) ?? []).length, 1);
  assert.equal((producer.match(/run: npm run ci:producer:validate/g) ?? []).length, 1);
  for (const step of [preparationStep, validationStep]) {
    assert.doesNotMatch(step, /continue-on-error:|\n        if:/u);
    assert.match(step, /PLAYWRIGHT_BROWSERS_PATH: \$\{\{ runner\.temp \}\}\/playwright/u);
    assert.match(step, /XPOTATO_RELEASE_TEMP: \$\{\{ runner\.temp \}\}\/release-validation/u);
  }
  assert.match(producer, /release-validation\/home-design-webkit\.json/);
  assert.equal(
    JSON.parse(readFileSync(new URL("../../package.json", import.meta.url))).devDependencies
      .playwright,
    "1.65.0",
  );
});
test("only superseded PR runs are cancelled and dependency caching never caches test success", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(
    workflow,
    /group: vnext-ci-\$\{\{ github\.event_name == 'pull_request' && format\('pr-\{0\}', github\.event\.pull_request\.number\) \|\| format\('run-\{0\}', github\.run_id\) \}\}/,
  );
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci --prefer-offline/);
  assert.match(workflow, /run: npm run ci:producer:prepare/);
  assert.match(workflow, /run: npm run ci:producer:validate/);
  assert.match(workflow, /run: npm run ci:hosted:gate/);
  assert.match(workflow, /run: npm run release:package/);
  assert.doesNotMatch(workflow, /pull_request_target|workflow_run|contents: write|actions: write/);
});
test("supplementary reports cannot become a score/build/upload gate", () => {
  assert.ok(
    !expanded("release:produce").some((c) =>
      /(?:lighthouse-report\.mjs|external-links-cli\.ts|quality:lighthouse)/.test(c),
    ),
  );
  const source = readFileSync(new URL("../qa/lighthouse-report.mjs", import.meta.url), "utf8");
  assert.match(source, /collectLighthouse/);
  assert.doesNotMatch(source, /'autorun'|'upload'|'assert'|@lhci/);
  assert.match(source, /withinTemp/);
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(
    workflow,
    /Supplementary Lighthouse report[\s\S]*?continue-on-error: true[\s\S]*?run: npm run quality:lighthouse/,
  );
});

test("Hosted source jobs preserve all checks while the one producer gates packaging", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const sections = Object.fromEntries(
    [...workflow.matchAll(/^  ([a-z-]+):\n([\s\S]*?)(?=^  [a-z-]+:|$(?![\s\S]))/gm)].map(
      (match) => [match[1], match[2]],
    ),
  );
  for (const name of [
    "article-regression",
    "source-validation",
    "publication-fixtures",
    "common-tool",
    "producer",
  ]) {
    assert.match(sections[name], /needs: \[scope, article-fast\]/);
    assert.match(
      sections[name],
      /!cancelled\(\)[\s\S]*needs\.scope\.outputs\.article == 'false'[\s\S]*needs\.article-fast\.result == 'success' && needs\.article-fast\.outputs\.eligible == 'false'/,
    );
    assert.match(
      sections[name],
      /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
    );
    assert.match(sections[name], /persist-credentials: false/);
    assert.match(sections[name], /npm ci --prefer-offline/);
    assert.doesNotMatch(
      sections[name].split("    steps:")[0],
      /runner\./,
      "runner context is available only inside steps, not job-level env",
    );
  }
  assert.match(sections["source-validation"], /run: npm run ci:source:validate/);
  assert.match(sections["publication-fixtures"], /run: npm run ci:fixtures:lifecycle/);
  assert.match(sections["common-tool"], /run: npm run release:interaction -- common-tool/);
  assert.equal(
    scripts["ci:source:validate"],
    "npm run ci:source:preflight && npm run test && npm run test:release && npm run ci:source:checks",
  );
  assert.equal(
    scripts["ci:source"].split(" && npm run test && npm run test:release")[0],
    "npm run ci:source:preflight",
  );
  assert.equal(
    scripts["ci:fixtures:lifecycle"],
    "npm run toolchain:check && npm run publication:isolation:prepare",
  );
  assert.equal(
    scripts["ci:fixtures:isolation"],
    "npm run authoring:isolation:prepare && npm run review:isolation:prepare && npm run visual:isolation:prepare && tsx ops/qa/article-publication-isolation.ts --prepare-isolation-only",
  );
  assert.equal(
    scripts["ci:final:public"],
    scripts["ci:final"].replace(
      "npm run release:interaction",
      "npm run release:interaction -- public",
    ),
  );
  const hosted = expanded("release:produce:hosted");
  const build = hosted.indexOf("npm run build --workspace @xpotato/site");
  const isolation = hosted.indexOf(
    "tsx ops/qa/article-publication-isolation.ts --prepare-isolation-only",
  );
  const gate = hosted.indexOf("node ops/ci/ci-hosted-gate.mjs");
  const pack = hosted.indexOf("tsx ops/build/release-package-cli.ts");
  assert.equal(
    hosted.filter((command) => command === "npm run build --workspace @xpotato/site").length,
    1,
  );
  assert.ok(isolation >= 0 && isolation < build && build < gate && gate < pack);
  assert.ok(
    sections.producer.indexOf("run: npm run ci:producer:validate") <
      sections.producer.indexOf("run: npm run ci:hosted:gate"),
  );
  assert.ok(
    sections.producer.indexOf("run: npm run ci:hosted:gate") <
      sections.producer.indexOf("run: npm run release:package"),
  );
  assert.equal((sections.producer.match(/GH_TOKEN:/g) ?? []).length, 1);
  assert.match(
    sections.producer,
    /name: Require this attempt's independent[\s\S]*?GH_TOKEN:[^\n]+\n        run: npm run ci:hosted:gate/,
  );
  // The bootstrap job deliberately has no npm dependencies; inspect this fixed flow list only.
  const needs = sections.result.match(/^ {4}needs:\s*\[([^\]]*)\]/mu);
  assert.ok(needs, "result must explicitly depend on the required jobs");
  const names = needs[1]
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/gu, ""))
    .filter(Boolean);
  assert.deepEqual(names, [
    "scope",
    "offline-policy",
    "article-fast",
    "article-regression",
    "source-validation",
    "publication-fixtures",
    "common-tool",
    "producer",
    "windows-consumer",
  ]);
  for (const name of [
    "POLICY_RESULT",
    "ARTICLE_RESULT",
    "ARTICLE_REGRESSION_RESULT",
    "SOURCE_RESULT",
    "FIXTURES_RESULT",
    "COMMON_TOOL_RESULT",
    "PRODUCER_RESULT",
    "CONSUMER_RESULT",
  ])
    assert.ok(sections.result.includes(`"$${name}" != success`), name);
});

test("verified drafts build once while public changes fall back to full validation", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const article = workflow.split("  article-fast:")[1].split("  article-regression:")[0];
  const fullJobs = [
    "article-regression",
    "source-validation",
    "publication-fixtures",
    "common-tool",
    "producer",
  ];
  assert.match(article, /needs: scope/);
  assert.match(
    article,
    /if: needs\.scope\.outputs\.core == 'true' && needs\.scope\.outputs\.article == 'true'/,
  );
  assert.match(article, /run: npm run ci:article:fast/);
  assert.match(article, /XPOTATO_SITE_TEMP_ROOT: \$\{\{ runner\.temp \}\}\/article-validation/);
  assert.doesNotMatch(article, /GH_TOKEN:|CLOUDFLARE_|release:package|upload-artifact|deploy-site/);
  for (const name of fullJobs) {
    const block = workflow.split("  " + name + ":")[1].split(/^  [a-z-]+:/m)[0];
    assert.match(block, /needs: \[scope, article-fast\]/);
    assert.match(
      block,
      /!cancelled\(\)[\s\S]*needs\.scope\.outputs\.article == 'false'[\s\S]*needs\.article-fast\.result == 'success' && needs\.article-fast\.outputs\.eligible == 'false'/,
    );
  }
  const result = workflow.split("  result:")[1];
  assert.match(result, /if: always\(\)/);
  assert.match(result, /ARTICLE_RESULT: \$\{\{ needs\.article-fast\.result \}\}/);
  assert.match(result, /if \[\[ "\$ARTICLE" == true && "\$ARTICLE_ELIGIBLE" == true \]\]; then/);
  assert.match(result, /if \[\[ "\$ARTICLE_RESULT" != success \]\]; then/);
  assert.match(result, /"\$ARTICLE_RESULT" != skipped \|\| -n "\$ARTICLE_ELIGIBLE"/);
  assert.match(article, /run: node --import tsx ops\/ci\/article-pr-admission\.ts/);
  assert.match(article, /if: steps\.admission\.outputs\.eligible == 'true'/);
  assert.match(
    workflow,
    /CI_FORCE_FULL: \$\{\{ contains\(github\.event\.pull_request\.labels\.\*\.name, 'ci:full'\) \}\}/,
  );
  const required = [
    "validate:repository",
    "astro:check",
    "build",
    "publication:check",
    "validate:static",
    "performance:check",
    "site:output:check",
  ];
  const script = scripts["ci:article:fast"];
  for (const command of required) assert.ok(script.includes("npm run " + command), command);
  assert.ok(script.indexOf("npm run build") < script.indexOf("npm run publication:check"));
});
test("public image cache never admits test success, private sources or a skipped build", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const producer = workflow.split("  producer:")[1].split("  windows-consumer:")[0];
  const paths = [
    ".local/home-workshop-build/candidate.json",
    ".local/home-workshop-build/public-master",
    ".local/home-workshop-build/variants",
    ".local/home-workshop-build/mobile",
    ".local/home-workshop-build/social",
  ];
  const cacheSteps = [
    ...producer.matchAll(
      /uses: actions\/cache\/(restore|save)@([^ \n]+)[\s\S]*?path: \|\n((?:            [^\n]+\n)+)/g,
    ),
  ];
  assert.equal(cacheSteps.length, 2);
  for (const [, , pin, block] of cacheSteps) {
    assert.equal(pin, "55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
    assert.deepEqual(
      block
        .trim()
        .split("\n")
        .map((path) => path.trim()),
      paths,
    );
  }
  assert.doesNotMatch(producer, /restore-keys:/);
  assert.equal((producer.match(/steps\.media-cache-restore\.outputs\.cache-hit/g) ?? []).length, 1);
  assert.match(
    producer,
    /name: Save verified public derived images only\n        if: steps\.media-cache-restore\.outputs\.cache-hit != 'true'\n        continue-on-error: true/,
  );
  assert.match(producer, /\[\[ -n "\$MATCHED_KEY" && "\$MATCHED_KEY" != "\$EXPECTED_KEY" \]\]/);
  assert.ok(
    producer.indexOf("run: npm run ci:media-cache:key") <
      producer.indexOf("run: npm run ci:producer:prepare"),
  );
  assert.ok(
    producer.indexOf("run: npm run ci:hosted:gate") <
      producer.indexOf("run: npm run ci:media-cache:verify"),
  );
  assert.ok(
    producer.indexOf("run: npm run ci:media-cache:verify") <
      producer.indexOf("name: Save verified public derived images only"),
  );
  const hosted = expanded("release:produce:hosted");
  assert.ok(
    hosted.indexOf("node --import tsx ops/build/home-workshop/ci-cache.ts verify") <
      hosted.indexOf("tsx ops/build/release-package-cli.ts"),
  );
});

test("hosted browser jobs prepare font caches once before their existing required checks", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const preparation = "run: node ops/ci/prepare-chrome-font-cache.mjs";
  assert.equal(workflow.split(preparation).length - 1, 2);
  for (const [name, command] of [
    ["source-validation", "run: npm run ci:source:validate"],
    ["common-tool", "run: npm run release:interaction -- common-tool"],
  ]) {
    const job = workflow.split("\n  " + name + ":")[1].split(/\n  [a-z][a-z-]*:/u)[0];
    const prepare = job.indexOf(preparation);
    assert.ok(prepare > job.indexOf("run: npm ci --prefer-offline"), name);
    assert.ok(prepare < job.indexOf(command), name);
    const step = job
      .split("name: Prepare Chrome font cache for isolated profiles")[1]
      .split(/\n      - /u)[0];
    assert.doesNotMatch(step, /continue-on-error:|\n        if:/u, name);
  }
  const browserPreparation = scripts["ci:browsers:prepare"].split(" && ");
  assert.deepEqual(browserPreparation, [
    "npm run toolchain:check",
    "npx --no-install playwright install --with-deps webkit",
    "node ops/ci/prepare-chrome-font-cache.mjs",
  ]);
  const producer = workflow.split("\n  producer:")[1].split(/\n  [a-z][a-z-]*:/u)[0];
  assert.ok(
    producer.indexOf("run: npm run ci:producer:prepare") <
      producer.indexOf("run: npm run ci:producer:validate"),
  );
  assert.match(scripts["test:release"], /ops\/ci\/prepare-chrome-font-cache\.test\.mjs/u);
  assert.match(scripts["test:release"], /ops\/qa\/chrome-font-cache\.test\.mjs/u);
  assert.match(scripts["test:release"], /ops\/ci\/producer-parallel\.test\.mjs/u);
  assert.match(workflow, /run: node --test[^\n]*ops\/ci\/producer-parallel\.test\.mjs/u);
});

test("hosted CI pins Linux ABI and caches only versioned WebKit binaries after real layout checks", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const producer = workflow.split("  producer:")[1].split("  windows-consumer:")[0];
  assert.equal((workflow.match(/runs-on: ubuntu-24\.04/g) ?? []).length, 9);
  assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/);
  const steps = [
    "name: Restore version-pinned WebKit browser binaries",
    "name: Require exact restored WebKit cache identity",
    "name: Prepare the one public build and browser engines concurrently",
    "name: Validate the same build in WebKit and Chrome concurrently",
    "name: Save WebKit browser cache after its real CSS smoke passes",
  ];
  let previous = -1;
  for (const step of steps) {
    const current = producer.indexOf(step);
    assert.ok(current > previous, step + " must run after its predecessor");
    previous = current;
  }
  const exactKey = "site-webkit-v1-ubuntu-24.04-${{ runner.arch }}-playwright-1.65.0";
  assert.equal(producer.split("key: " + exactKey).length - 1, 2);
  assert.equal((producer.match(/path: \$\{\{ runner\.temp \}\}\/playwright/g) ?? []).length, 2);
  assert.match(
    producer,
    /name: Save WebKit browser cache after its real CSS smoke passes\n        if: steps\.webkit-cache\.outputs\.cache-hit != 'true'\n        continue-on-error: true/,
  );
  for (const name of [steps[1], steps[2], steps[3]]) {
    const step = producer.slice(producer.indexOf(name)).split(/\n      - /u)[0];
    assert.doesNotMatch(step, /continue-on-error:|\n        if:/u, name + " remains mandatory");
  }
  assert.match(producer, /steps\.webkit-cache\.outputs\.cache-primary-key/u);
  assert.match(producer, /steps\.webkit-cache\.outputs\.cache-matched-key/u);
  assert.match(producer, /Unexpected WebKit cache key'; exit 1/u);
  assert.match(
    scripts["ci:browsers:prepare"],
    /npx --no-install playwright install --with-deps webkit/,
  );
  assert.doesNotMatch(producer, /restore-keys:/);
});
test("parallel public UI suite retains required design-role checks and both quality artifact sets", () => {
  const suite = readFileSync(
    new URL("../qa/release-interaction-suite.mjs", import.meta.url),
    "utf8",
  );
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(
    suite,
    /import\s*\{\s*verifyDesignRoleInteraction\s*\}\s*from\s*["']\.\/design-role-interaction\.mjs["']/u,
  );
  const probe = suite.indexOf("await measured(verifyDesignRoleInteraction)");
  const search = suite.search(/const\s+searchClearReport\s*=/u);
  assert.ok(
    probe > 0 && probe < search,
    "Design-role assertions run before the remaining public UI checks",
  );
  assert.match(suite.slice(probe, search), /design-roles-final-dist\.json/);
  assert.match(suite.slice(probe, search), /if\s*\(suite\s*===\s*["']remaining["']\)/);
  for (const artifact of [
    "axe-*-final-dist.json",
    "release-*-result.json",
    "design-roles-final-dist.json",
    "project-carousel-browser.json",
    "carousel-*.png",
  ]) {
    assert.ok(
      workflow.includes("/release-validation/" + artifact),
      "Retain quality artifact: " + artifact,
    );
  }
});

test("site and editor build concurrently once, and all settlements precede composition", async () => {
  const started = [],
    releases = [];
  let ended = false;
  const run = runApplicationBuilds((script) => {
    started.push(script);
    return new Promise((resolve) => releases.push(resolve));
  }).then(() => {
    ended = true;
  });
  assert.deepEqual(started, ["build:site", "build:editor"]);
  assert.equal(ended, false);
  releases[0]();
  await Promise.resolve();
  assert.equal(ended, false);
  releases[1]();
  await run;
  assert.equal(ended, true);
  const graph = expanded("release:produce");
  assert.equal(graph.filter((c) => c === "npm run build --workspace @xpotato/editor").length, 1);
  let settled = false;
  await assert.rejects(
    runApplicationBuilds(async (script) => {
      if (script === "build:site") throw Error("fixture failure");
      await Promise.resolve();
      settled = true;
    }),
  );
  assert.equal(settled, true);
});
