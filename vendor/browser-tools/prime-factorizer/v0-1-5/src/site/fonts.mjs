// SPDX-License-Identifier: AGPL-3.0-only
import {SITE_FONT_TEXT} from './font-text.mjs';
// Use only existing host @font-face rules and fixed public UI text, before ready.
export async function prepareSiteFonts(root){
 const doc=root.ownerDocument,view=doc.defaultView;if(typeof doc.fonts?.load!=='function'||!view?.getComputedStyle)return;
 const family=view.getComputedStyle(root).fontFamily,extra=root.closest?.('[data-bt-font-text]')?.getAttribute('data-bt-font-text')??'';
 if(extra.length>4096)throw Error('Finite host font text required');
 const text=SITE_FONT_TEXT+extra;
 await Promise.all([400,500,600,700].map(weight=>doc.fonts.load(weight+' 16px '+family,text)));
 await doc.fonts.ready;
}
