export function convert(value) {
  if (new TextEncoder().encode(value).length > 4096) return "入力は4096 bytes以内にしてください";
  return "文字数: " + Array.from(value).length + " / " + value;
}
