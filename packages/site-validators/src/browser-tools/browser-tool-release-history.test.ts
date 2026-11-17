import { it, expect } from "vitest";
import { browserToolPinSchema } from "@xpotato/content-contracts";
import { parseToolReleaseHistory } from "./browser-tool-release-history.js";

// Parser tests must not depend on which releases happen to be literal rather than generated.
const literalPin = browserToolPinSchema.parse({
  schemaVersion: 1,
  toolId: "synthetic-history",
  releaseId: "fixture-v1",
  packageName: "@xpotato-tool/synthetic-history",
  source: { kind: "github", repository: "https://github.com/Example/synthetic-history" },
  sourceCommit: "a".repeat(40),
  sourceTreeSha256: "b".repeat(64),
  lockSha256: "c".repeat(64),
  manifestSha256: "d".repeat(64),
  artifactSha256: "e".repeat(64),
  reviewSha256: "f".repeat(64),
});

const registryHeader =
  'import { generatedReleases } from "./generated/records.js";\nimport type { BrowserToolPin } from "@xpotato/content-contracts";\n';

it("reads every literal historical pin and rejects factories, shadowing, hidden spreads and malformed registries", () => {
  const pinsInput = [
    literalPin,
    { ...literalPin, releaseId: "fixture-v2", artifactSha256: "1".repeat(64) },
  ];
  const source =
    registryHeader +
    "export const browserToolReleases = Object.freeze([...generatedReleases," +
    pinsInput.map((pin) => JSON.stringify(pin)).join(",") +
    "]);";
  const pins = parseToolReleaseHistory(source);
  expect(pins).toEqual(pinsInput);
  expect(pins.length).toBeGreaterThan(0);
  expect(new Set(pins.map((p) => p.toolId + ":" + p.releaseId)).size).toBe(pins.length);
  const changes = [
    source.replace("Object.freeze(", "injectUnreviewed("),
    source.replace("Object.freeze(", "Object.freeze?.("),
    source.replace("...generatedReleases,", "...generatedReleases,...otherHistorical,"),
    source.replace("...generatedReleases,", "...generatedReleases,...generatedReleases,"),
    source.replace("export const browserToolReleases", "const browserToolReleases"),
    source.replace("export const browserToolReleases", "export let browserToolReleases"),
    source + "\nconst Object={freeze:()=>[]};\n",
    source + "\nexport const browserToolReleases=Object.freeze([...generatedReleases]);\n",
    source.replace("Object.freeze([", "[").replace("]);", "];"),
    source + "\ninvalid(",
  ];
  for (const invalid of changes) expect(() => parseToolReleaseHistory(invalid)).toThrow();
});

it("reads literal pins independently of indentation, quote style, trailing commas and unquoted keys", () => {
  const expected = [literalPin];
  const header = registryHeader;
  const literal = JSON.stringify(expected[0], null, 2).replace(
    /"([A-Za-z][A-Za-z0-9]*)":/gu,
    "$1:",
  );
  const formatted =
    header +
    "export const browserToolReleases: readonly BrowserToolPin[] = Object.freeze([\n...generatedReleases,\n" +
    literal +
    ",\n]);";
  expect(parseToolReleaseHistory(formatted)).toEqual([expected[0]]);
  expect(parseToolReleaseHistory(formatted.replaceAll('"', "'"))).toEqual([expected[0]]);
});

it("never evaluates object factories, computed keys, getters, spreads or duplicate properties", () => {
  const pin = literalPin;
  const header =
    'import { generatedReleases } from "./generated/records.js";\nimport type { BrowserToolPin } from "@xpotato/content-contracts";\n';
  const literal = JSON.stringify(pin);
  const invalidObjects = [
    literal.replace('"schemaVersion":1', "schemaVersion: readVersion()"),
    literal.replace('"schemaVersion":1', "get schemaVersion() { return 1; }"),
    literal.replace('"schemaVersion":1', '["schemaVersion"]: 1'),
    literal.replace('"schemaVersion":1', "...{schemaVersion: 1}"),
    literal.replace('"schemaVersion":1', "schemaVersion:1,schemaVersion:1"),
    literal.replace('"schemaVersion":1', "schemaVersion:1,__proto__:{}"),
  ];
  for (const invalid of invalidObjects) {
    expect(invalid).not.toBe(literal);
    expect(() =>
      parseToolReleaseHistory(
        header +
          "export const browserToolReleases = Object.freeze([...generatedReleases," +
          invalid +
          "]);",
      ),
    ).toThrow();
  }
});

it("accepts a registry whose releases are all generated without inventing historical pins", () => {
  expect(
    parseToolReleaseHistory(
      registryHeader + "export const browserToolReleases = Object.freeze([...generatedReleases]);",
    ),
  ).toEqual([]);
});
