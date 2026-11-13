import {describe,it,expect} from 'vitest';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
import {canonicalJson,sha256} from '../canonical.js';
import {fixedAuditInstruction} from './existing-audit-material.js';
import {encodeAuditArtifacts,decodeAuditArtifacts,codexAuditPrompt,compactAuditPromptFormat,
 assertCodexAuditPromptCapacity,codexAuditPromptCharacterLimit} from './codex-audit-prompt.js';

const artifact=(artifactId:string,text:string)=>({artifactId,bytes:Buffer.from(text),sha256:sha256(text)});
const json=(id:string,value:unknown)=>artifact(id,canonicalJson(value));
describe('lossless readable Codex audit prompt',()=>{
 it.each(['xpotato-fixed-audit-task-v2','xpotato-audit-json-references-v1'])('blocks the private transport marker in JSON, nested data and HTML: %s',protocol=>{
  for(const source of [JSON.stringify({protocol}),JSON.stringify({nested:{protocol}}),'<pre>'+JSON.stringify({protocol})+'</pre>'])
   expect(privateDraftOutputErrors('public-output.json',source)).toHaveLength(1);
 });
 it('shares repeated complete source structures and strings, retaining the exact artifact inventory and hashes',()=>{
  const source={sourceId:'source-a',snapshot:'Full source body. 日本語 👩🏽‍💻\r\n'.repeat(4000),metadata:{url:'https://example.invalid/source'}};
  const evidence={evidenceId:'e1',quote:'Quoted paragraph '.repeat(50)};
  const inputs=[json('audit-sources',{sources:[source]}),json('audit-analysis',{sources:[source],bundle:{evidence:[evidence]}}),
   json('audit-evidence',{evidence:[evidence]}),artifact('audit-body','Body references retained source.'),artifact('audit-copy',source.snapshot)];
  const bundle=encodeAuditArtifacts(inputs),restored=decodeAuditArtifacts(JSON.parse(canonicalJson(bundle)));
  expect(restored).toEqual(inputs);
  expect(canonicalJson(bundle).length).toBeLessThan(inputs.reduce((sum,a)=>sum+a.bytes.length,0)/2);
  expect(canonicalJson(bundle)).toContain(source.snapshot.slice(0,20).replace('\r','\\r').replace('\n','\\n'));
  expect(bundle.definitions.length).toBeGreaterThan(0);
  expect(encodeAuditArtifacts(inputs)).toEqual(bundle);
 });
 it('escapes reserved literal objects and unusual keys without interpreting source data as transport',()=>{
  const reserved=JSON.parse('{"$auditRef":0,"$auditObject":[["literal","value"]],"__proto__":{"x":1},"constructor":"keep"}');
  const nested={nested:[reserved,reserved],long:'x'.repeat(500)};
  const inputs=[json('one',nested),json('two',nested),json('array',[null,true,false,0,-2.5,String.fromCharCode(0xd800),'é','é',reserved])];
  expect(decodeAuditArtifacts(encodeAuditArtifacts(inputs))).toEqual(inputs);
 });
 it('preserves noncanonical JSON, trailing whitespace, BOM, CRLF and text byte-for-byte',()=>{
  const inputs=[artifact('pretty','{\r\n  "z": 1, "a": [1,2] \r\n}\r\n'),artifact('bom','\ufeff{"x":1}'),
   artifact('numbers','{"n":1e2,"n":3,"negative":-0}'),artifact('text','日本語 👩🏽‍💻\r\n\\ "quoted" \n'),
   artifact('empty',''),json('null',null),json('string','text')];
  const bundle=encodeAuditArtifacts(inputs);
  expect(bundle.artifacts[0]!.encoding).toBe('utf8');
  expect(bundle.artifacts[1]!.encoding).toBe('utf8');
  expect(decodeAuditArtifacts(bundle)).toEqual(inputs);
 });
 it('rejects substituted bytes, duplicate IDs and invalid UTF-8 before encoding',()=>{
  const a=artifact('a','source');
  expect(()=>encodeAuditArtifacts([{...a,bytes:Buffer.from('changed')}])).toThrow('BYTES_INVALID');
  expect(()=>encodeAuditArtifacts([a,a])).toThrow('SET_INVALID');
  const bytes=Buffer.from([0xff]);expect(()=>encodeAuditArtifacts([{artifactId:'bad',bytes,sha256:sha256(bytes)}])).toThrow();
 });
 it('rejects mutated references, hashes, lengths, cycles, ambiguous markers and excessive expansion',()=>{
  const original=encodeAuditArtifacts([json('a',{body:'source'.repeat(100)}),json('b',{body:'source'.repeat(100)})]);
  const changes=[
   (b:any)=>{b.artifacts[0].sha256='0'.repeat(64);},
   (b:any)=>{b.artifacts[0].sizeBytes--;},
   (b:any)=>{b.artifacts[0].value={$auditRef:999};},
   (b:any)=>{b.artifacts[0].value={$auditRef:-1};},
   (b:any)=>{b.artifacts[0].value={$auditRef:0,extra:true};},
   (b:any)=>{b.definitions[0]={$auditRef:0};},
   (b:any)=>{b.definitions[0]='altered source';},
   (b:any)=>{b.artifacts[0].value={$auditObject:[['same',1],['same',2]]};},
   (b:any)=>{b.definitions=[['x'.repeat(1000)],Array(1000).fill({$auditRef:0})];b.artifacts[0].value={$auditRef:1};},
  ];
  for(const change of changes){const b=structuredClone(original);change(b);expect(()=>decodeAuditArtifacts(b)).toThrow('REFERENCE_INVALID');}
 });
 it('keeps legacy prompt bytes stable and selects the compact protocol only with a recognized version',()=>{
  const p={request:{requestId:'fixed'},manifest:{manifestSha256:'fixed'},artifacts:[json('a',{source:'x'.repeat(1000)}),
   json('b',{source:'x'.repeat(1000)}),artifact('audit-image-hero','binary-image')]};
  const expected=canonicalJson({protocol:'xpotato-fixed-audit-task-v1',instruction:fixedAuditInstruction,request:p.request,
   disclosureManifest:p.manifest,artifacts:p.artifacts.slice(0,2).map(a=>({id:a.artifactId,sha256:a.sha256,text:a.bytes.toString('utf8')})),
   attachedImages:[{id:p.artifacts[2]!.artifactId,sha256:p.artifacts[2]!.sha256}]});
  expect(codexAuditPrompt(p)).toBe(expected);
  const compact=JSON.parse(codexAuditPrompt(p,compactAuditPromptFormat));
  expect(compact.protocol).toBe('xpotato-fixed-audit-task-v2');
  expect(decodeAuditArtifacts(compact.artifactBundle)).toEqual(p.artifacts.slice(0,2));
  expect(compact.attachedImages).toEqual(JSON.parse(expected).attachedImages);
  expect(()=>codexAuditPrompt(p,null)).toThrow('FORMAT_INVALID');
  expect(()=>codexAuditPrompt(p,'future')).toThrow('FORMAT_INVALID');
 });
 it('fits a formerly oversized source/evidence/analysis fixture without source truncation',()=>{
  const source={snapshot:'Full article source '.repeat(30_000)},evidence={quote:'Full quote '.repeat(4000)};
  const p={request:{},manifest:{},artifacts:[json('audit-sources',{sources:[source]}),json('audit-evidence',evidence),
   json('audit-analysis',{sources:[source],evidence})]};
  expect(()=>assertCodexAuditPromptCapacity(codexAuditPrompt(p))).toThrow('TOO_LARGE');
  const prompt=codexAuditPrompt(p,compactAuditPromptFormat);
  expect(assertCodexAuditPromptCapacity(prompt)).toBeLessThan(750_000);
  expect(decodeAuditArtifacts(JSON.parse(prompt).artifactBundle)).toEqual(p.artifacts);
 });
 it('enforces the exact Unicode character boundary including supplementary characters',()=>{
  expect(assertCodexAuditPromptCapacity('x'.repeat(codexAuditPromptCharacterLimit))).toBe(codexAuditPromptCharacterLimit);
  expect(()=>assertCodexAuditPromptCapacity('x'.repeat(codexAuditPromptCharacterLimit+1))).toThrow('TOO_LARGE');
  expect(assertCodexAuditPromptCapacity('😀'.repeat(codexAuditPromptCharacterLimit))).toBe(codexAuditPromptCharacterLimit);
 });
});
