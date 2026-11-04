import {parseArgs} from 'node:util';
import {createPageDraft} from './page-authoring.js';
const {positionals,values}=parseArgs({allowPositionals:true,options:{slug:{type:'string'},title:{type:'string'},description:{type:'string'}}});
if(positionals.join(' ')!=='page create'||!values.slug||!values.title||!values.description){
 console.error('Usage: npm run content -- page create --slug <name> --title <title> --description <summary>');process.exitCode=2;
}else{
 try{console.log(JSON.stringify(await createPageDraft(process.cwd(),{slug:values.slug,title:values.title,description:values.description}),null,2));}
 catch(error){console.error(error instanceof Error?error.message:'PAGE_CREATE_FAILED');process.exitCode=1;}
}
