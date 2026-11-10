import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { fingerprint, sha256 } from '@xpotato/content-contracts/canonical';

describe('Prime speed editorial evidence', () => {
  const source = readFileSync('apps/site/src/content/tools/prime-factorizer.mdx', 'utf8');
  const data = parse(/^---\n([\s\S]*?)\n---/u.exec(source)![1]!);
  const ledger = JSON.parse(readFileSync('apps/site/src/content-registry/editorial/manual-revisions-v1.json', 'utf8'));
  const revision = ledger.revisions.find((item: { targetPath: string }) => item.targetPath.endsWith('/prime-factorizer.mdx'));
  const evidence = JSON.parse(readFileSync('docs/benchmarks/prime-ui-20261110.json', 'utf8'));
  it('keeps the short title, fixed identity and explicit comparison scope', () => {
    expect(data.title).toBe('最速の素因数分解計算機');
    expect(data.id).toBe('bca48f98-c89a-457f-84d8-168f941fe469');
    expect(data.draft).toBe(false);
    expect(data.description).toContain('216〜256bitの5入力');
    expect(data.description).toContain('同一条件で比較した');
    expect(data.description).toContain('入力値・結果は外部送信しません');
    expect(source).toContain('2以上の整数を入力して「分解する」を押してください');
    expect(source).toContain('192bitの入力ではrusqsieveのほうが高速');
    expect(source).toContain('すべての入力・端末で最速であることを保証するものではありません');
    expect(source).toContain('<Demo module="prime-factorizer" title="素因数分解を試す" />');
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
