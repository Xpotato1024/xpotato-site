export function convert(value) {
  if (new TextEncoder().encode(value).length > __INPUT_BYTES__) throw Error("入力は__INPUT_BYTES__ bytes以内にしてください");
  return "文字数: " + Array.from(value).length;
}
