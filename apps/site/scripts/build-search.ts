import { buildSearchIndex } from '../src/features/discovery/search/build-index.js';
import { withSearchThumbnail } from './search-thumbnail.js';
const {documents}=await buildSearchIndex(undefined,withSearchThumbnail);
console.log('Search index PASS: '+documents.length+' documents');
