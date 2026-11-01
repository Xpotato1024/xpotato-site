import {stringify} from 'yaml';
import {splitDraft} from './draft-job.js';
import {sha256} from './canonical.js';

/** A new received intake is required; never edits an existing Job, audit,
 * approval, source file or article. The received AI text remains AI-origin.
 * Only first-publication dates are derived from the operator's current day.
 */
export function prepareExistingPublicationMetadata(original:string,publicationDate:string,now=new Date()){
 if(!Number.isFinite(now.valueOf())||!/^\d{4}-\d{2}-\d{2}$/u.test(publicationDate)
  ||publicationDate!==new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)){
  throw Error('CURRENT_JST_PUBLICATION_DAY_REQUIRED');
 }
 const before=splitDraft(original),{updatedDate:omittedUpdatedDate,...fields}=before.frontmatter;
 const frontmatter={...fields,pubDate:publicationDate};
 const manuscript='---\n'+stringify(frontmatter,{lineWidth:0}).trimEnd()+'\n---\n'+before.body;
 const after=splitDraft(manuscript);if(after.body!==before.body)throw Error('PUBLICATION_BODY_CHANGED');
 return {manuscript,lineage:{protocol:'xpotato-existing-publication-metadata-v1' as const,
  origin:'existing_ai' as const,originalMdxSha256:sha256(original),mdxSha256:sha256(manuscript),bodySha256:sha256(before.body),
  changes:{pubDate:{before:before.frontmatter.pubDate,after:publicationDate},updatedDate:{before:omittedUpdatedDate??null,after:null}},
  dateTimeZone:'Asia/Tokyo' as const,humanAuthorship:false as const,humanAudit:false as const,humanApproval:false as const,
  storageMutation:false as const,productionEligible:false as const}};
}
