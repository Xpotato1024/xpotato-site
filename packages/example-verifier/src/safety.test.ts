import { describe, expect, it } from "vitest";
import { classifyTechnicalExample, verificationClaimLabel } from "./index.js";
import { exampleSandboxProfileV1 } from "./profiles.js";

describe("technical example boundary", () => {
  it.each([
    ["bash", "sudo apt install fixture"],
    ["bash", "systemctl restart fixture"],
    ["bash", "mkfs.ext4 /dev/example"],
    ["bash", "ufw allow 443"],
    ["bash", "ssh host.example"],
    ["bash", "curl https://example.test"],
    ["bash", "docker run fixture"],
    ["bash", "kubectl apply -f fixture.yaml"],
    ["bash", "aws s3 cp fixture s3://example"],
    ["bash", "git push origin main"],
    ["powershell", "Restart-Computer"],
  ])("rejects dangerous classes (%s)", (language, source) => {
    expect(classifyTechnicalExample(language, source).kind).toBe("reject");
  });

  it("executes only self-contained initial languages", () => {
    expect(classifyTechnicalExample("python", "print(2 + 2)")).toMatchObject({ kind: "execute", profileId: "python-stdlib-v1" });
    expect(classifyTechnicalExample("node", "console.log(2 + 2)")).toMatchObject({ kind: "execute" });
    expect(classifyTechnicalExample("sql", "select 1;")).toMatchObject({ kind: "execute" });
  });

  it("does not call a syntax pass 動作確認済み", () => {
    const disposition = classifyTechnicalExample("powershell", "Get-Date");
    expect(disposition.kind).toBe("parse_or_typecheck");
    expect(verificationClaimLabel(disposition)).toBe("構文・型検査済み");
  });

  it("locks the sandbox limits", () => {
    expect(exampleSandboxProfileV1).toMatchObject({
      network: "none",
      user: "non-root",
      rootFilesystem: "read-only",
      memoryMaxBytes: 268_435_456,
      pidsMax: 32,
      cpuCoresMax: 1,
      wallTimeoutSeconds: 15,
      combinedOutputMaxBytes: 1_048_576,
    });
  });
});
