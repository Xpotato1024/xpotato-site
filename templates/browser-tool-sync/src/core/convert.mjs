import {fontText} from '../ui/font-text.mjs';
export function convert(value) {
  if (new TextEncoder().encode(value).length > __INPUT_BYTES__) throw Error(fontText.limit);
  return fontText.result + Array.from(value).length;
}
