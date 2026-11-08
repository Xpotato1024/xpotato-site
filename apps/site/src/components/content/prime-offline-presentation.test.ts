import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
const read=(file:string)=>readFile(new URL(file,import.meta.url),'utf8');
describe('Prime offline presentation',()=>{
  it('shows the benefit, explicit save control and status without opening a disclosure',async()=>{
    const source=await read('./PrimeOffline.astro');
    expect(source).toMatch(/<section[^>]*data-prime-offline[^>]*aria-labelledby="prime-offline-title"/u);
    expect(source.indexOf('data-prime-offline-save')).toBeLessThan(source.indexOf('<details'));
    expect(source.indexOf('data-prime-offline-status')).toBeLessThan(source.indexOf('<details'));
    expect(source).toContain('オンラインで一度保存すれば');
    expect(source).toContain('入力・計算結果・設定は保存しません');
    expect(source).toContain('検索・記事・外部リンクには通信が必要');
    expect(source).toContain('容量不足やブラウザによる整理で保存が消える');
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source.match(/<details\b/gu)).toHaveLength(1);
  });
  it('places PWA before the tool, on the Prime page only',async()=>{
    const route=await read('../../pages/tools/[...slug].astro');
    expect(route).toContain('{release?.toolId === "prime-factorizer" && <PrimeOffline />}');
    expect(route.indexOf('<PrimeOffline />')).toBeLessThan(route.indexOf('<Content components='));
  });
  it('removes the requested Issue warning and retains both contact routes',async()=>{
    const source=await read('./ToolContact.astro');
    expect(source).not.toContain('GitHub Issueは公開されます');
    expect(source).not.toContain('秘密情報・個人情報・ツールへ入力した実データ');
    expect(source).toContain('GitHubでIssueを作成');
    expect(source).toContain('/contact/#contact-bugs');
  });
});
