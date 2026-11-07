import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {inspectContactIssuesMarkup,validateContactIssuesSource} from './contact-issues-runtime.js';
import {analyzeBuiltHtml,renderSecurityHeaderArtifact,validateBuiltHtmlAgainstSecurityHeaders} from './security-headers.js';
const markup='<div data-contact-issues><select id="issue-target"></select><details data-issue-fallback></details></div><script type="module" src="/scripts/contact-issues.js"></script>';
describe('contact-only progressive enhancement boundary',()=>{
  it('admits the picker through CSP only on contact and checks its source',()=>{
    const inputs=[{path:'contact/index.html',html:markup}],analysis=analyzeBuiltHtml(inputs),headers=renderSecurityHeaderArtifact(analysis);
    expect(analysis.errors).toEqual([]);
    expect(validateBuiltHtmlAgainstSecurityHeaders(headers,inputs,[{path:'scripts/contact-issues.js',source:'fetch("/")'}])).toContain('Contact picker dependencies, network, navigation, storage and dynamic code are forbidden');
    expect(analyzeBuiltHtml([{path:'about/index.html',html:markup}]).errors.length).toBeGreaterThan(0);
  });
  it('requires exactly one contact picker, its module and no-JS fallback',()=>{
    expect(inspectContactIssuesMarkup(markup,'/contact/').script).toBe(true);
    for(const html of [markup+markup,markup.replace('<details data-issue-fallback></details>',''),markup.replace('type="module"','type="module" async')]) expect(()=>inspectContactIssuesMarkup(html,'/contact/')).toThrow();
    expect(()=>inspectContactIssuesMarkup(markup,'/about/')).toThrow();
    expect(inspectContactIssuesMarkup('<h1>About</h1>','/about/').script).toBe(false);
  });
  it('accepts the small reviewed source and rejects network/storage/navigation/dependencies',()=>{
    validateContactIssuesSource(readFileSync(new URL('../../../../apps/site/public/scripts/contact-issues.js',import.meta.url),'utf8'));
    for(const source of ['fetch("https://example.invalid")','location.href="/"','window.open("/")','localStorage.getItem("x")','import("./other.js")','x'.repeat(2001)]) expect(()=>validateContactIssuesSource(source)).toThrow();
  });
});
