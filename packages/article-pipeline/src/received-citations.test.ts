import {it,expect} from 'vitest';
import {fixtureReviewInputs} from './content-review-fixture.js';
import {compileReceivedCitations} from './received-citations.js';
import {sha256} from './canonical.js';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
it('compiles pinned numeric markers without changing the original claim span identity',()=>{
 const body='本文の設定です。[1]\n',start=body.indexOf('[1]'),sources=fixtureReviewInputs().sources.sources.map(s=>s.record);
 const out=compileReceivedCitations(body,sources,[{start,end:start+3,sourceIds:['s0001']}]);
 expect(out.compiled).toContain('本文の設定です。[^cite-1]');expect(out.manifest.bodySha256).toBe(sha256(body));
 expect(out.manifest.bindings[0]?.sourceId).toBe('s0001');expect(out.patches[0]?.start).toBe(start);
});
it.each(['# 見出し[1]\n','[リンク[1]](https://example.invalid)\n','```text\n[1]\n```\n'])(
 'rejects numeric text outside supported paragraph positions: %s',body=>{
 const start=body.indexOf('[1]'),sources=fixtureReviewInputs().sources.sources.map(s=>s.record);
 expect(()=>compileReceivedCitations(body,sources,[{start,end:start+3,sourceIds:['s0001']}])).toThrow('LOCATION');
});
it('rejects overlap, stale spans, unknown Source IDs and mixed citation formats',()=>{
 const body='本文[1]\n',start=body.indexOf('[1]'),sources=fixtureReviewInputs().sources.sources.map(s=>s.record);
 const m={start,end:start+3,sourceIds:['s0001']};
 for(const markers of [[m,m],[{...m,start:start-1}],[{...m,sourceIds:['missing']}],[{...m,sourceIds:['s0001','s0001']}]] )
  expect(()=>compileReceivedCitations(body,sources,markers)).toThrow();
 expect(()=>compileReceivedCitations(body+'\n[@s0001]\n',sources,[m])).toThrow('MIXED');
});
it('keeps received source bundles and nested hosted-audit artifacts out of public output',()=>{
 expect(privateDraftOutputErrors('unexpected.json',JSON.stringify({scope:'existing_ai',authorPrincipalId:'author',sources:[]}))).toHaveLength(1);
 for(const protocol of ['xpotato-private-hosted-agent-audit-observation-v1','xpotato-private-existing-ai-content-audit-response-v1','xpotato-private-existing-ai-visual-audit-response-v1'])
  expect(privateDraftOutputErrors('unexpected.html','<pre>'+JSON.stringify({response:{protocol}})+'</pre>')).toHaveLength(1);
});
