"""Reproduce the reviewed core WOFF2 files; normal builds never invoke Python."""
import argparse, hashlib, json, logging, tempfile, os, subprocess, sys
from pathlib import Path
import fontTools
import brotli
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools import subset

if os.environ.get('PYTHONHASHSEED')!='0':
    raise SystemExit(subprocess.run([sys.executable,__file__,*sys.argv[1:]],env={**os.environ,'PYTHONHASHSEED':'0'}).returncode)
parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
if fontTools.__version__!='4.66.1' or brotli.__version__!='1.2.0':raise RuntimeError('Pinned FontTools 4.66.1 and Brotli 1.2.0 required')
logging.basicConfig(level=logging.ERROR)
repo=Path(__file__).resolve().parent.parent;inputs=json.loads((repo/'docs/performance/font-core-input-v1.json').read_text(encoding='utf8'));font_dir=repo/'apps/site/public/fonts'
source=(repo/'apps/site/src/styles/fonts.css').read_text(encoding='utf8').replace('\r\n','\n')
if hashlib.sha256(source.encode()).hexdigest()!=inputs['sourceStylesheetSha256']:raise RuntimeError('Original font definition changed; review/regenerate input')
with tempfile.TemporaryDirectory(prefix='xpotato-core-font-') as temporary:
    work=Path(temporary);css=[];records=[]
    for group in inputs['groups']:
        paths=[]
        for item in group['files']:
            path=font_dir/item['filename'];assert path.parent==font_dir
            if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Original font binary changed')
            paths.append(str(path))
        original=TTFont(paths[0],recalcTimestamp=False);created=original['head'].created
        font=Merger().merge(paths) if len(paths)>1 else original;font.recalcTimestamp=False
        options=subset.Options();options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.hinting=True;options.recalc_timestamp=False
        worker=subset.Subsetter(options=options);worker.populate(unicodes=group['unicodes']);worker.subset(font)
        font.flavor='woff2';font['head'].created=created;font['head'].modified=created;temporary_font=work/'subset.woff2';font.save(temporary_font);raw=temporary_font.read_bytes();digest=hashlib.sha256(raw).hexdigest();name='font-'+digest[:16]+'.woff2';actual=sorted(font.getBestCmap())
        ranges=','.join('U+'+format(c,'X') for c in actual)
        css.append("@font-face {font-family: '%s';font-style: normal;font-weight: %s;font-display: swap;src: url(/fonts/%s) format('woff2');unicode-range: %s;}"%(group['family'],group['weight'],name,ranges))
        records.append({'family':group['family'],'weight':group['weight'],'filename':name,'bytes':len(raw),'glyphs':len(actual),'sha256':digest})
        if args.write:(font_dir/name).write_bytes(raw)
        elif not (font_dir/name).exists() or (font_dir/name).read_bytes()!=raw:raise RuntimeError('Core font differs from reproducible output: '+name)
    stylesheet='/* Generated offline; SIL OFL originals and fallback slices retained. */\n'+'\n'.join(css)+'\n'
    manifest={'schemaVersion':1,'toolchain':{'fonttools':'4.66.1','brotli':'1.2.0','python':'CPython 3.12 Windows x64'},'inputSha256':hashlib.sha256((repo/'docs/performance/font-core-input-v1.json').read_bytes().replace(b'\r\n',b'\n')).hexdigest(),'stylesSha256':hashlib.sha256(stylesheet.encode()).hexdigest(),'fonts':records}
    css_path=repo/'apps/site/src/styles/fonts-core.css';manifest_path=repo/'docs/performance/font-core-output-v1.json'
    if args.write:css_path.write_text(stylesheet,encoding='utf8',newline='\n');manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
    else:
        if css_path.read_text(encoding='utf8')!=stylesheet or json.loads(manifest_path.read_text(encoding='utf8'))!=manifest:raise RuntimeError('Core font metadata differs from reproducible output')
    print('PASS: four core fonts reproduced byte-for-byte' if not args.write else 'Wrote reviewed core fonts and provenance')
