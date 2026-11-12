import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { fingerprint, sha256 } from '@xpotato/content-contracts/canonical';

describe('Prime speed editorial evidence', () => {
  const source = readFileSync('apps/site/src/content/tools/prime-factorizer.mdx', 'utf8');
  const data = parse(/^---\n([\s\S]*?)\n---/u.exec(source)![1]!);
  const ledger = JSON.parse(readFileSync('apps/site/src/content-registry/editorial/manual-revisions-v1.json', 'utf8'));
  const revision = ledger.revisions.find((item: { targetPath: string }) => item.targetPath.endsWith('/prime-factorizer.mdx'));
  const installations = JSON.parse(readFileSync('config/browser-tools/installations.json', 'utf8'));
  const activePin = installations.installations.find((item: { pin: { toolId: string } }) => item.pin.toolId === 'prime-factorizer').pin;
  const activeSource = `vendor/browser-tools/prime-factorizer/${activePin.releaseId}/src/`;
  const evidence = JSON.parse(readFileSync('docs/benchmarks/prime-ui-20261110.json', 'utf8'));
  it('shows the algorithm overview before the existing instructions without expanding the description', () => {
    const overview = '試し割り、Pollardのρ法（Brent改良版）、楕円曲線法（ECM）、SIQS（自己初期化二次ふるい法）を、整数の大きさや実行条件に応じて使い分けます。大きな整数向けのSIQSでは、WebAssemblyのSIMD演算とWorkerによる並列処理を組み合わせ、高速化しています。';
    const body = source.replace(/^---\n[\s\S]*?\n---\n/u, '');
    expect(body.startsWith(overview + '\n\n2以上の整数を入力して「分解する」を押してください。')).toBe(true);
    expect(data.description).toBe('最大309桁（1024bit以下）の整数入力に対応。ブラウザで素因数分解し、結果をコピーできます。桁数は通常モードの受付上限で、分解完了の保証ではありません。入力値・結果は外部送信しません。');
    for (const sourceId of ['prime-v026-routing-overview', 'prime-v026-native-overview', 'prime-v026-siqs-workers-overview']) {
      const ref = revision.provenance.sourceRefs.find((item: { sourceId: string }) => item.sourceId === sourceId);
      expect(sha256(readFileSync(ref.path))).toBe(ref.blobSha256);
    }
    const claim = revision.provenance.materialClaims.find((item: { claimId: string }) => item.claimId === 'prime-algorithm-overview');
    expect(claim.statementSha256).toBe(sha256(overview));
  });
  it('keeps the short title, fixed identity and explicit comparison scope', () => {
    expect(data.title).toBe('最速の素因数分解計算機');
    expect(data.id).toBe('bca48f98-c89a-457f-84d8-168f941fe469');
    expect(data.draft).toBe(false);
    expect(data.description).toContain('最大309桁（1024bit以下）');
    expect(data.description).toContain('通常モードの受付上限');
    expect(data.description).toContain('分解完了の保証ではありません');
    expect(source).toContain('216〜256bitの5入力');
    expect(data.description).toContain('入力値・結果は外部送信しません');
    expect(source).toContain('2以上の整数を入力して「分解する」を押してください');
    expect(source).toContain('192bitの入力ではrusqsieveのほうが高速');
    expect(source).toContain('すべての入力・端末で最速であることを保証するものではありません');
    expect(source).toContain('<Demo module="prime-factorizer" title="素因数分解を試す" />');
  });
  it('verifies the accepted limits against the actual pinned adapter', async () => {
    const base = new URL(`../../../${activeSource}site/`, import.meta.url);
    const { SITE_MODES } = await import(new URL('capabilities.mjs', base).href);
    const { validateSiteInput } = await import(new URL('policy.mjs', base).href);
    for (const [mode, digits, bits] of [['standard',309,1024],['optimized',100,332],['wide',121,400]] as const) {
      expect(SITE_MODES[mode].maxDigits).toBe(digits);
      expect(SITE_MODES[mode].maxBits).toBe(bits);
      const largest = ((1n << BigInt(bits)) - 1n).toString();
      expect(largest).toHaveLength(digits);
      expect(validateSiteInput(largest, mode)).toBe(largest);
      expect(() => validateSiteInput((1n << BigInt(bits)).toString(), mode)).toThrow();
      expect(() => validateSiteInput('9'.repeat(digits + 1), mode)).toThrow();
    }
  });
  it('keeps the active input contract tied to the recorded limit evidence', () => {
    for (const sourceId of ['prime-v025-input-capabilities', 'prime-v025-input-limits', 'prime-v025-input-validation']) {
      const ref = revision.provenance.sourceRefs.find((item: { sourceId: string }) => item.sourceId === sourceId);
      const relativePath = ref.path.split('/src/')[1];
      expect(relativePath).toBeTruthy();
      expect(sha256(readFileSync(activeSource + relativePath))).toBe(ref.blobSha256);
    }
  });
  it('binds editorial bytes and the durable evidence source', () => {
    expect(revision.provenance.content.mdxSha256).toBe(sha256(source));
    expect(revision.provenance.content.frontmatterSha256).toBe(fingerprint(data));
    const ref = revision.provenance.sourceRefs.find((item: { sourceId: string }) => item.sourceId === 'prime-ui-benchmark-20261110');
    expect(ref.blobSha256).toBe(sha256(readFileSync(ref.path)));
    expect(source).toContain(`/blob/${ref.commitSha}/${ref.path}`);
  });
  it('supports five wins and retains the slower 192-bit case', () => {
    expect(evidence.trials).toHaveLength(24);
    for (const bits of [192, 216, 224, 232, 240, 256]) {
      const times = (arm: string) => evidence.trials.filter((trial: { bits: number; arm: string; verified: boolean }) => trial.bits === bits && trial.arm === arm && trial.verified).map((trial: { wallMs: number }) => trial.wallMs);
      const own = times('toolkit'), other = times('upstream');
      expect(own).toHaveLength(2); expect(other).toHaveLength(2);
      if (bits === 192) expect(Math.min(...own)).toBeGreaterThan(Math.max(...other));
      else expect(Math.max(...own)).toBeLessThan(Math.min(...other));
    }
    for (const item of evidence.cases) expect(item.f.reduce((product: bigint, value: string) => product * BigInt(value), 1n)).toBe(BigInt(item.n));
  });
});
