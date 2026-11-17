import {articleRoute,contentIdSchema} from '@xpotato/content-contracts';
import history from "./article-url-history.json" with {type:'json'};
if(history.schemaVersion!==1||history.records.length!==44||history.activation!=='published-targets-only')throw Error('ARTICLE_HISTORY_SHAPE');
const sources=new Set<string>(),ids=new Set<string>();
for(const r of history.records){contentIdSchema.parse(r.contentId);if(!r.sourcePath.startsWith('/blog/')||r.targetPath!==articleRoute(r.contentId)||sources.has(r.sourcePath)||ids.has(r.contentId))throw Error('ARTICLE_HISTORY_IDENTITY');sources.add(r.sourcePath);ids.add(r.contentId);}
export const articleUrlHistory=Object.freeze(history.records.map(r=>Object.freeze(r)));
