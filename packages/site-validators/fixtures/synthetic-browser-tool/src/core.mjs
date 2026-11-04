import {fontText} from './font-text.mjs';
export function convert(value) {
  if (new TextEncoder().encode(value).length > 4096) return fontText.limit;
  return fontText.result + Array.from(value).length + " / " + value;
}
