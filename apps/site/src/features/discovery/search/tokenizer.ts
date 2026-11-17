export const searchTokenizerId = "xpotato-ja-tech-bigram-v1" as const;

const cjkCharacter = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const technicalCharacter = /[a-z0-9_.+#-]/u;

const normalize = (value: string): string => value.normalize("NFKC").toLowerCase().replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ");

const runs = (value: string): readonly Readonly<{ kind: "cjk" | "technical"; text: string }>[] => {
  const output: Array<{ kind: "cjk" | "technical"; text: string }> = [];
  let kind: "cjk" | "technical" | undefined;
  let current = "";
  const flush = () => {
    if (kind && current) output.push({ kind, text: current });
    kind = undefined;
    current = "";
  };
  for (const character of [...normalize(value)]) {
    const nextKind = cjkCharacter.test(character) ? "cjk" : technicalCharacter.test(character) ? "technical" : undefined;
    if (!nextKind) {
      flush();
    } else if (kind === nextKind) {
      current += character;
    } else {
      flush();
      kind = nextKind;
      current = character;
    }
  }
  flush();
  return output;
};

export const tokenize = (value: string): readonly string[] => {
  const tokens: string[] = [];
  for (const run of runs(value)) {
    if (run.kind === "cjk") {
      const characters = [...run.text];
      if (characters.length <= 2) tokens.push(run.text);
      else for (let index = 0; index < characters.length - 1; index += 1) tokens.push(`${characters[index]}${characters[index + 1]}`);
      continue;
    }
    tokens.push(run.text);
    if (run.text.includes("-")) {
      const [head, ...tail] = run.text.split("-").filter(Boolean);
      if (head) tokens.push(head);
      if (tail.length > 0) tokens.push(tail.join("-"));
    }
  }
  return [...new Set(tokens)];
};

export const tokenizeCjkSingles = (value: string): readonly string[] =>
  [...new Set(runs(value).filter((run) => run.kind === "cjk").flatMap((run) => [...run.text]))];
