import {validateReviewContext,type EditorReviewContext} from '@xpotato/editor-core/review';
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function editorReviewImage(context:EditorReviewContext,assetId:string,alt:string){
 validateReviewContext(context);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(assetId)||typeof alt!=='string')throw Error('EDITOR_REVIEW_ASSET_INVALID');
 return '<span class="editor-review-image" data-editor-image-wrapper="'+escape(assetId)+'"><img data-editor-review-asset="'+escape(assetId)+'" alt="'+escape(alt)+'" decoding="async" /><span data-editor-image-missing="'+escape(assetId)+'">画像を認証済みCMSで解決: '+escape(alt||assetId)+'</span></span>';
}
