export * from "./profiles.js";

export type VerificationDisposition =
  | Readonly<{ kind: "execute"; profileId: string }>
  | Readonly<{ kind: "parse_or_typecheck"; profileId: string }>
  | Readonly<{ kind: "reject"; reason: string }>;

const dangerousPatterns: readonly Readonly<{ pattern: RegExp; reason: string }>[] = [
  { pattern: /\bsudo\b/iu, reason: "privilege escalation" },
  { pattern: /\b(?:apt|apt-get|yum|dnf|pacman|pip|npm)\s+(?:install|publish)\b/iu, reason: "package mutation" },
  { pattern: /\bsystemctl\b/iu, reason: "service mutation" },
  { pattern: /\b(?:fdisk|parted|mkfs|mount|umount)\b/iu, reason: "disk or mount mutation" },
  { pattern: /\b(?:iptables|nft|ufw|route|ip\s+(?:addr|link|route))\b/iu, reason: "firewall or network mutation" },
  { pattern: /\b(?:ssh|scp)\b/iu, reason: "remote shell or copy" },
  { pattern: /\b(?:curl|wget)\b/iu, reason: "arbitrary network workflow" },
  { pattern: /\b(?:docker|podman)\s+(?:run|build|push|compose\s+up)\b/iu, reason: "container workload" },
  { pattern: /\bkubectl\b/iu, reason: "Kubernetes mutation" },
  { pattern: /\b(?:aws|gcloud|az|wrangler)\b/iu, reason: "cloud CLI" },
  { pattern: /\bgit\s+(?:push|remote\s+(?:add|set-url))\b/iu, reason: "Git remote mutation" },
  { pattern: /\b(?:reboot|shutdown|poweroff|Restart-Computer|Stop-Computer)\b/iu, reason: "host lifecycle mutation" },
];

export const classifyTechnicalExample = (language: string, source: string): VerificationDisposition => {
  const dangerous = dangerousPatterns.find(({ pattern }) => pattern.test(source));
  if (dangerous) return { kind: "reject", reason: dangerous.reason };
  const normalized = language.toLowerCase();
  const profiles: Readonly<Record<string, string>> = {
    python: "python-stdlib-v1",
    javascript: "node-self-contained-v1",
    node: "node-self-contained-v1",
    sql: "sqlite-disposable-v1",
  };
  const parseProfiles: Readonly<Record<string, string>> = {
    bash: "bash-parse-v1",
    shell: "bash-parse-v1",
    powershell: "powershell-parse-v1",
    typescript: "typescript-check-v1",
    json: "json-parse-v1",
    yaml: "yaml-parse-v1",
    "docker-compose": "docker-compose-config-v1",
  };
  if (profiles[normalized]) return { kind: "execute", profileId: profiles[normalized] };
  if (parseProfiles[normalized]) return { kind: "parse_or_typecheck", profileId: parseProfiles[normalized] };
  return { kind: "reject", reason: "unsupported verification class" };
};

export const verificationClaimLabel = (disposition: VerificationDisposition): string => {
  if (disposition.kind === "execute") return "sandbox実行済み";
  if (disposition.kind === "parse_or_typecheck") return "構文・型検査済み";
  return "未実行";
};
