// SPDX-License-Identifier: AGPL-3.0-only
import {createElement,useEffect,useRef} from 'react';
import {mountSiteFactorizer} from './mount.mjs';
export default function PrimeFactorizer(){
 const ref=useRef(null);
 useEffect(()=>{let app=mountSiteFactorizer(ref.current);const view=ref.current.ownerDocument.defaultView;const restore=event=>{if(event.persisted){app.dispose();app=mountSiteFactorizer(ref.current);}};view?.addEventListener('pageshow',restore);return()=>{view?.removeEventListener('pageshow',restore);app.dispose();};},[]);
 return createElement('div',{className:'bt-prime-factorizer','data-bt':'',ref,'data-prime-tool-version':'0.2.2'},'計算ファイルを準備しています。');
}
