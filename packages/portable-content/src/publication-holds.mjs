/** Current publication policy, not a replay of migration steps. */
export const publicationHoldsPath='content/registry/publication-holds.json';
export function readPublicationHoldIds(value){
 if(value?.schemaVersion!==1||!Array.isArray(value.records)||value.records.length!==44)throw Error('HELD_MANIFEST_POLICY_CHANGED');
 const ids=value.records.map(row=>{if(!row||Object.keys(row).sort().join('|')!=='contentId|reason'||row.reason!=='media-publication-pending'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.contentId))throw Error('HELD_MANIFEST_POLICY_CHANGED');return row.contentId;});
 if(new Set(ids).size!==ids.length)throw Error('HELD_MANIFEST_POLICY_CHANGED');
 return ids;
}
export function assertPublicationHolds(catalog,ids){
 for(const id of ids){const entries=catalog.filter(entry=>entry.routeRecord.contentId===id);if(entries.length!==1||entries[0].routeRecord.collection!=='blog'||entries[0].disposition!=='held_candidate'||entries[0].source.data.draft!==true)throw Error('PUBLICATION_HOLD_VIOLATED: '+id);}
}
