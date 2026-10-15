
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function verifyPrivateDraftInteraction({root,send,evaluate,until,requests}) {
  const receipt=JSON.parse(await readFile(join(root,'.local/authoring-isolation/receipt.json'),'utf8'));
  const child=spawn(process.execPath,['--import','tsx',join(root,'scripts/site.ts'),'article','preview','--job',receipt.jobId,'--draft','--json'],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},
  });
  let url, failure=false, text='';
  child.on('error',()=>{failure=true;});
  child.stdout.on('data',bytes=>{
    text+=bytes.toString('utf8');
    for(const line of text.split('\n')){
      try {const data=JSON.parse(line);if(data.url)url=data.url;if(data.error)failure=true;}catch{}
    }
  });
  child.stderr.resume();
  try{
    await until(()=>{if(failure||child.exitCode!==null)throw Error('Private preview startup failed');return url;},'Private preview localhost startup');
    const start=requests.length;
    await send('Page.navigate',{url});
    await until(()=>evaluate('document.readyState==="complete" && document.querySelector("main")?.textContent.includes('+JSON.stringify(receipt.marker)+')'),'Private Japanese Markdown preview');
    assert.equal(await evaluate('document.querySelectorAll("script,astro-island,img,iframe").length'),0);
    assert.equal(await evaluate('document.querySelectorAll("table").length'),1);
    assert.ok(await evaluate('document.body.textContent.includes("画像未準備") && document.body.textContent.includes("正式候補・公開承認ではありません")'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Private preview mobile overflow');
    await evaluate('window.scrollTo(0,document.body.scrollHeight)');
    assert.deepEqual(requests.slice(start).filter(request=>/^https?:/u.test(request.url)).map(request=>request.url),[url],'Only the one localhost document is requested; no fonts/images/provider/assets');
    assert.equal(await evaluate('fetch("https://must-not-request.invalid/").then(()=>false,()=>true)'),true,'Private CSP blocks outbound fetch');
    await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
    console.log('Private draft browser PASS: Japanese Markdown/table/footnote, mobile, no runtime/media, one loopback request, no external request; not candidate/approval');
  }finally{
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
  }
}
