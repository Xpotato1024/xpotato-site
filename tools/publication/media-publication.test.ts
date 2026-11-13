import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cli=resolve('tools/publication/media-publication.ts');
it.each(['prepare-owner-subject','prepare-owner-reviewed'])('%s cannot operate inside CI or create operator authority from a file',command=>{
 const result=spawnSync(process.execPath,['--import','tsx',cli,command,'--job','job-fixture','--file','approved-owner.json','--visual-input','fixture.json','--output','.local/not-created.json'],
  {cwd:resolve('.'),encoding:'utf8',env:{...process.env,CI:'true'}});
 expect(result.status).toBe(1);expect(result.stderr).toContain('"articleDeployed":false');
 expect(result.stdout).not.toContain('prepared');
},30000);
