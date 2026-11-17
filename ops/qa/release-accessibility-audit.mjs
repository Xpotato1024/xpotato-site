import assert from 'node:assert/strict';
// axe's aria-allowed-role is tagged best-practice, not WCAG. Keep every existing WCAG rule and add it explicitly.
export const releaseAxeAuditExpression = `axe.run(document, { runOnly: { type: 'rule', values: [...new Set([...axe.getRules(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).map(rule => rule.ruleId), 'aria-allowed-role'])] } }).then(r => ({ version: r.testEngine.version, violations: r.violations.map(v => ({ id:v.id, impact:v.impact, targets:v.nodes.map(n=>n.target) })), incomplete:r.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})) }))`;

export async function verifyReleaseRoleAuditRegression(evaluate) {
  await evaluate(`(() => {const fixture=document.createElement('div');fixture.id='qa-invalid-carousel-role';fixture.innerHTML='<ul role="presentation"><li id="qa-invalid-carousel-role-slide" role="group" aria-label="Test slide">Test slide</li></ul>';document.body.append(fixture);})()`);
  try {
    const result = await evaluate(releaseAxeAuditExpression);
    assert.ok(result.violations.some(v=>v.id==='aria-allowed-role'&&v.targets.some(target=>target.join(' ').includes('qa-invalid-carousel-role-slide'))), 'The release audit must detect the deliberately invalid li/group fixture: '+JSON.stringify(result.violations));
  } finally { await evaluate(`document.getElementById('qa-invalid-carousel-role').remove()`); }
}
