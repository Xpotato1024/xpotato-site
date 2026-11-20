export function readMathMeta(meta: string): {
  label: string;
  printSource: boolean;
  valid: boolean;
} {
  // 空欄や引用符を入力中も保持し、末尾の印刷設定は説明文から切り離す。
  const match = /^label="(.*?)"(?: print="(source)")?$/u.exec(meta);
  const label = match?.[1] ?? "";
  return {
    label,
    printSource: match?.[2] === "source",
    valid: Boolean(
      match && label.trim() && label.length <= 160 && !/["\u0000-\u001f\u007f]/u.test(label),
    ),
  };
}

export function writeMathMeta(label: string, printSource: boolean): string {
  return 'label="' + label.replace(/[\r\n]/gu, "") + '"' + (printSource ? ' print="source"' : "");
}
