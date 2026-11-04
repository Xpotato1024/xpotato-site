import {parseArgs} from 'node:util';
import {createContentDraft} from './content-draft.js';
const {positionals,values}=parseArgs({allowPositionals:true,options:{slug:{type:'string'},title:{type:'string'},description:{type:'string'},'pub-date':{type:'string'},subject:{type:'string'},tag:{type:'string',multiple:true}}});
const command=positionals.join(' '),page=command==='page create',note=command==='note create';
if((!page&&!note)||!values.slug||!values.title||!values.description||(note&&!values['pub-date'])||(page&&(values['pub-date']||values.subject||values.tag))){
 console.error('Usage: npm run content -- page create --slug <name> --title <title> --description <summary>\n       npm run content -- note create --slug <name> --title <title> --description <excerpt> --pub-date <YYYY-MM-DD> [--subject <id>] [--tag <id>]');process.exitCode=2;
}else{
 try{console.log(JSON.stringify(await createContentDraft(process.cwd(),page
  ? {collection:'pages',slug:values.slug,title:values.title,description:values.description}
  : {collection:'notes',slug:values.slug,title:values.title,description:values.description,pubDate:values['pub-date']!,...(values.subject?{subject:values.subject}:{}),...(values.tag?{tags:values.tag}:{})}),null,2));}
 catch(error){console.error(error instanceof Error?error.message:'CONTENT_CREATE_FAILED');process.exitCode=1;}
}
