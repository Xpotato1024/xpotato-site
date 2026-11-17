import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';

// Editorial fixtures for blind semantic evaluation, NOT a prose/image classifier.
// Supply context/candidate under neutral IDs; withhold accept/reason and paired IDs.
const pairs = [
  ['section-anchor', '主要説明節で操作前後の違いを説明する。',
    '該当段落の隣に同じ実UIの前後比較を置き、見る場所を示す。',
    '冒頭のheroがあるので、本文の説明節には視覚的な手掛かりを置かない。',
    '説明位置で要点を確認できるか。heroは局所説明の一括代替ではない。'],
  ['table-anchor', '経験者向けに三方式の適用条件を説明する節。',
    '方式・条件・例外を対応させた表を説明の近くに置く。',
    '表は画像ではないので不合格とし、無関係な写真を足す。',
    '説明を支える表も視覚的な手掛かりとして認める。'],
  ['expert-visual', '熟練者向けに短い設定変更の節を書く。',
    '既知のUI文脈を残し、変更点だけを近接する拡大図に示す。',
    '専門家には短文で分かるので図表を省く。',
    '熟達度と短さは説明節の視覚的な手掛かりを免除しない。'],
  ['what-anchor', '「スライサーとは何か」を二文で説明する節。',
    '定義に加え、モデルと層が見える実画面を近くに示す。',
    '何かを説明するだけの短い節なので、定義文のみで済ませる。',
    '定義節でも対象を識別できる局所の視覚的な手掛かりが必要。'],
  ['summary-exception', '既出の判断を二文で振り返るまとめ。新しい説明はない。',
    '新情報がないため図を反復しないと編集メモに残し、結びを短く置く。',
    '全H3に画像が必要なので、無関係な装飾写真を足す。',
    '理由を伴うまとめの省略を認め、画像ノルマと水増しを避ける。'],
  ['bridge-source-exception', '既出節を結ぶ一文と、出典だけの注記。新しい説明はない。',
    '接続と出典提示だけを担うため図は省略すると編集メモに理由を残す。',
    '短い節はすべて図なしでよいので、新概念を説明する節にも省略を広げる。',
    '短い橋渡しや出典注記の例外を、説明節への一般的な免除にしない。'],
  ['shared-anchor', '隣接する二つの短い説明が同じ図の領域A/Bを扱う。',
    '両説明から図が見え、A/Bの対応も明確なので一図を共有する。',
    '同じ図は遠い付録にあるので、本文では場所も対応も示さない。',
    '共有は近接・可視性・対応が明確な場合に限る。'],
  ['object-labels', '紫のモデルと、実UIにある対象名を注釈で示す。',
    '対象名を覆わず、近くの中立色パネルと番号付き領域枠で結ぶ。',
    '紫の対象に同じ紫の文字を重ね、UIラベルを覆う交差矢印を引く。',
    '主題と注釈の役割を分け、ラベルの遮蔽と遠い線の追跡を避ける。'],
  ['contrast-shape', '紫の対象に暖色の注釈を付ける写真。背景は複雑。',
    'アンバーを候補にし、暗い文字と中立色パネル、白黒ハロー、番号枠と拡大cropを使う。実背景で通常文字4.5:1、意味のある図形と隣接下地3:1を確認し、320/390pxの実グリフ・灰色/印刷でも確認する。',
    '補色だから読みやすい。token二色の計算だけで全写真背景も合格とする。',
    '色相差や単一token計算は実画像の証明にならず、形・番号と実表示の確認が要る。'],
  ['assumed-measurement', '実測記録はない。USBメモリ2本の収納例を示す。',
    '整理したいUSBメモリ2本を各58×18×8 mm、空間を84×60×22 mmと仮定し、余裕と設計へつなぐ。',
    '手元で各58×18×8 mmと測った。収納実験で収まると確認した。',
    '明示した仮定は使えるが、もっともらしい値を測定・実験結果へ変えない。'],
  ['measured-evidence', '同じ内容物の測定記録・方法・単位が根拠として供給されている。',
    '記録に対応する実測値として説明し、設計上の余裕は別に示す。',
    '一つの実測値を全製品の寸法保証とし、公差も不要とする。',
    '実測は根拠の対象と範囲に結び、保証や公差へ一般化しない。'],
  ['inner-outer', '上面開放トレー。外寸80×55×18 mm、壁厚2 mm、底厚2 mm。',
    '有効内寸76×51×16 mmで、内容物と取り出し余裕を検討する。',
    '外寸80×55×18 mmをそのまま収納可能な内寸として扱う。',
    '横二軸は壁を両側、深さは底を一枚引き、外寸と有効内寸を区別する。'],
  ['finished-model', 'USBメモリ2本のトレーを設計し、完成イメージを示す。',
    '設計と同じトレーに、名前で識別できる同じUSBメモリ2本を示す。',
    '完成図は別の箱と無名の直方体に差し替え、免責文だけを長く置く。',
    '用途・内容物・設計・完成図を一貫させ、免責で具体例を代替しない。'],
] as const;

describe('section visual editorial corpus/reference structure (not semantic quality)', () => {
  it('keeps contextual positive/negative examples with reasons and unique IDs', () => {
    const schema = z.object({id:z.string().regex(/^[a-z0-9-]+$/u), context:z.string().min(1), candidate:z.string().min(1), accept:z.boolean(), reason:z.string().min(1)}).strict();
    const cases = pairs.flatMap(([topic,context,positive,negative,reason]) => [
      {id:topic+'-accept',context,candidate:positive,accept:true,reason},
      {id:topic+'-reject',context,candidate:negative,accept:false,reason},
    ]);
    z.array(schema).parse(cases);
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
    for (const [index, pair] of pairs.entries()) {
      const [positive, negative] = cases.slice(index*2, index*2+2);
      expect(positive!.context).toBe(negative!.context);
      expect(positive!.accept).toBe(true);
      expect(negative!.accept).toBe(false);
      expect(positive!.candidate, pair[0]).not.toBe(negative!.candidate);
    }
  });

  it('resolves the existing shared editorial references from the entrypoint', async () => {
    const root = join(process.cwd(), '.agents/skills/japanese-technical-blog');
    const skill = await readFile(join(root, 'SKILL.md'), 'utf8');
    for (const name of ['concrete-visual-editorial', 'first-draft-quality-gate', 'audience-and-visual-scale']) {
      expect(skill).toContain('references/'+name+'.md');
      expect((await readFile(join(root, 'references', name+'.md'), 'utf8')).length).toBeGreaterThan(0);
    }
  });

  it('binds section defaults, truthful example dimensions and annotation roles to the canonical reference', async () => {
    const source=await readFile(join(process.cwd(),'.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md'),'utf8');
    for(const heading of ['## 説明章の視覚的な支え','## 数値例は用途から設計へつなぐ','## 注釈は被写体と役割を分ける'])expect(source).toContain(heading);
    expect(source).toContain('説明章は原則として');expect(source).toContain('図・画像・グラフ・表');
    expect(source).toContain('まとめ');expect(source).toContain('全H3');expect(source).toContain('ヒーローがあるだけで');
    expect(source).not.toContain('短い説明で保持・照合の負担がない場合は図を増やさず');
    expect(source).toContain('実測記録のない数値');expect(source).toContain('外寸と有効内寸');
    expect(source).toContain('番号付き領域枠');expect(source).toContain('色だけへ意味を預けない');
    for(const name of ['contrast-minimum','non-text-contrast','use-of-color'])expect(source).toContain('https://www.w3.org/WAI/WCAG22/Understanding/'+name+'.html');
    const brief=await readFile(join(process.cwd(),'templates/content/article-brief.md'),'utf8');
    expect(brief).toContain('説明章ごとの問い');expect(brief).toContain('数値例の用途');expect(brief).toContain('注釈と主題');
  });
  it('checks only arithmetic for the explicitly assumed open tray, not actual fit', () => {
    const outer = [80,55,18], wall = 2, base = 2;
    const inner = [outer[0]!-2*wall, outer[1]!-2*wall, outer[2]!-base];
    expect(inner).toEqual([76,51,16]);
    expect(inner.map((n,i) => n-[58,18*2,8][i]!)).toEqual([18,15,8]);
    expect([84,60,22].map((n,i) => n-outer[i]!)).toEqual([4,5,4]);
  });
});
