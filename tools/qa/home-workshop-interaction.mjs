import {verifySharedHeaderInteraction} from './shared-header-interaction.mjs';
import {verifyHomeMenuTransition} from './home-menu-transition.mjs';
import {verifyHomeToolRows} from './home-tools-interaction.mjs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
export async function verifyHomeWorkshopInteraction({ send, evaluate, until, origin, setFailure, verifyMenu, audit, screenshot }) {
  const records = [];
  const navigate = async () => {
    await send('Page.navigate', { url: origin + '/' });
    await until(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector(".workshop-photo img"))'), 'Homepage photo markup');
    await evaluate('document.fonts.ready.then(()=>true)');
    await until(()=>evaluate(`document.querySelector('.header-band').getAnimations({subtree:true}).every(animation=>animation.playState==='finished'||animation.playState==='idle')`),'Initial header settles before steady-state audits');
  };
  const snapshot = () => evaluate(`(() => {
    const img=document.querySelector('.workshop-photo img'),hero=document.querySelector('.home-intro'),updates=document.querySelector('.home-updates'),projects=document.querySelector('.home-projects');
    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const catchNode=document.querySelector('.home-catch'),catchStyle=getComputedStyle(catchNode),catchRange=document.createRange();catchRange.selectNodeContents(catchNode);
    const links=selector=>[...document.querySelectorAll(selector)].map(a=>({path:a.pathname,text:a.textContent.replace('→','').trim(),...rect(a)}));
    return {complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading,priority:img.fetchPriority,alt:img.alt,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},sourceWidth:Number([...img.closest('picture').querySelectorAll('[srcset]')].flatMap(node=>node.srcset.split(',')).map(value=>value.trim().split(' ')).find(([url])=>new URL(url,location.href).href===img.currentSrc)?.[1]?.replace('w','')),
      overflow:document.documentElement.scrollWidth>innerWidth,hero:rect(hero),projects:rect(projects),background:getComputedStyle(hero).backgroundColor,
      title:document.querySelector('#home-title').innerText.replace(/\\s+/g,' ').trim(),brand:document.querySelector('.home-brand')?.textContent??null,titleWords:[...document.querySelectorAll('.home-title-static > span')].map(rect),updatesStart:rect(document.querySelector('[data-update-latest]')),firstUpdate:rect(document.querySelector('.home-updates a')),catch:{...rect(catchNode),text:catchNode.textContent.trim(),fontSize:parseFloat(catchStyle.fontSize),lineHeight:parseFloat(catchStyle.lineHeight),color:catchStyle.color,opacity:Number(catchStyle.opacity),whiteSpace:catchStyle.whiteSpace,marginTop:parseFloat(catchStyle.marginTop),lines:catchRange.getClientRects().length,clipped:catchNode.scrollWidth>catchNode.clientWidth+1,afterTitle:document.querySelector('#home-title').nextElementSibling===catchNode},titleBottom:rect(document.querySelector('#home-title')).bottom,heroControls:hero.querySelectorAll('a,button').length,description:document.querySelector('meta[name="description"]').content,sectionOrder:[...document.querySelectorAll('.home > section')].map(n=>n.querySelector('h2')?.textContent.trim()).filter(Boolean),
      standaloneBands:document.querySelectorAll('.home-introduction,.home-contact').length,links:links('.home-intro a'),about:links('.site-footer a[href="/about/"]'),topics:links('.home-topics a'),contact:links('.site-footer a[href="/contact/"]'),navigationPaths:['.desktop-navigation','#site-menu','.mobile-menu-fallback nav'].map(selector=>links(selector+' a').map(link=>link.path)),
      updatesAfterHero:hero.nextElementSibling===updates,duplicateCatch:document.querySelector('main').textContent.includes('考えたことを、つくって確かめる。'),
      incorrectArrows:[...document.querySelectorAll('main a')].filter(a=>a.origin===location.origin&&a.textContent.includes('↗')).map(a=>a.href)};
  })()`);
  // Composite the declared translucent foreground over actual photo pixels, not opaque white.
  const sampleCatchContrast=async()=>{
    const bounds=await evaluate(`(()=>{const p=document.querySelector('.home-catch'),s=getComputedStyle(p),range=document.createRange();range.selectNodeContents(p);return{rects:[...range.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),color:s.color,opacity:Number(s.opacity),viewportWidth:innerWidth,oldVisibility:p.style.visibility}})()`);
    const channels=bounds.color.match(/[\d.]+/g).map(Number),alpha=(channels[3]??1)*bounds.opacity;
    const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    try{
      await evaluate(`(()=>{document.querySelector('.home-catch').style.visibility='hidden';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      const capture=await send('Page.captureScreenshot',{format:'png'});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const scale=info.width/bounds.viewportWidth;let minRatio=Infinity;
      for(const rect of bounds.rects)for(let y=Math.max(0,Math.ceil(rect.y*scale));y<Math.min(info.height,Math.floor((rect.y+rect.height)*scale));y++)for(let x=Math.max(0,Math.ceil(rect.x*scale));x<Math.min(info.width,Math.floor((rect.x+rect.width)*scale));x++){
        const offset=(y*info.width+x)*info.channels,background=[...data.subarray(offset,offset+3)];
        const foreground=background.map((value,index)=>channels[index]*alpha+value*(1-alpha)),bgLum=luminance(background),fgLum=luminance(foreground);
        minRatio=Math.min(minRatio,(Math.max(fgLum,bgLum)+.05)/(Math.min(fgLum,bgLum)+.05));
      }
      assert.ok(Number.isFinite(minRatio)&&minRatio>=4.5,'Rendered alpha-composited catch contrast '+minRatio);
      return{minRatio,alpha,method:'minimum alpha-composited foreground/background contrast across rendered text-line bounds with glyphs hidden'};
    }finally{await evaluate(`(()=>{document.querySelector('.home-catch').style.visibility=${JSON.stringify(bounds.oldVisibility)};return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);}
  };
  const validateLayout=data=>{
    assert.equal(data.overflow,false);assert.equal(data.updatesAfterHero,true);assert.equal(data.standaloneBands,0);assert.equal(data.duplicateCatch,false);
    assert.equal(data.title,'Think. Build. Run.');assert.equal(data.brand,null);
    assert.deepEqual(data.topics,[],'The introduction no longer maps the three phrases to potentially misleading destinations');
    const rows=new Set(data.titleWords.map(word=>Math.round(word.y)));
    assert.equal(rows.size,3,'The static headline keeps three rows');
    assert.deepEqual(data.links,[]);assert.equal(data.heroControls,0,'Hero has no CTA or other controls');
    assert.equal(data.catch.text,'ものづくり、プログラミング、日々の試行錯誤');assert.equal(data.catch.afterTitle,true);
    assert.equal(data.catch.clipped,false);assert.notEqual(data.catch.whiteSpace,'nowrap');
    assert.ok(data.catch.y>=data.titleBottom-1,'Catch clears the unchanged English title');
    assert.ok(data.catch.x>=0&&data.catch.right<=data.viewport.width&&data.catch.bottom<=data.hero.bottom,'Catch reflows inside hero');
    assert.equal(data.description,'Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。');
    assert.deepEqual(data.sectionOrder,['更新状況','新着記事','つくったもの','ブラウザで使えるツール'],'Updates and articles precede active projects, then tools');
    assert.deepEqual(data.about.map(link=>link.path),['/about/']);
    assert.deepEqual(data.contact.map(link=>link.path),['/contact/']);
    assert.deepEqual(data.incorrectArrows,[]);
    assert.ok([...data.links,...data.about,...data.contact].every(link=>link.width>=44&&link.height>=44&&link.x>=0&&link.right<=data.viewport.width),'Home destinations retain 44px targets and fit');
    assert.equal(data.contact[0].text,'問い合わせ');
    for(const paths of data.navigationPaths)for(const path of ['/about/','/contact/'])assert.ok(paths.includes(path),'About/contact remain in desktop, native menu and fallback navigation');
  };
  for (const [width,height,dpr=1] of [[393,700,2],[393,700,2.625],[393,700,3],[1487,844],[1440,900],[1440,700],[430,832],[431,832],[760,900],[761,900],[393,700],[390,744],[375,667],[390,600],[320,568]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:dpr, mobile:width<=760 });
    await send('Network.clearBrowserCache');await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Homepage image decoded');
    const data=await snapshot();validateLayout(data);
    assert.ok(data.catch.fontSize>=14&&data.catch.fontSize<=16,'Default catch size is 14–16px');
    const catchColor=data.catch.color.match(/[\d.]+/g).map(Number),catchAlpha=(catchColor[3]??1)*data.catch.opacity;
    assert.ok(catchColor.slice(0,3).every(value=>value>=240)&&catchAlpha===1,'Catch uses opaque near-white for readability');
    assert.ok(data.catch.marginTop>=0&&data.catch.marginTop<=data.catch.fontSize,'Catch stays close to headline');
    if(width===393||width>=1440)assert.equal(data.catch.lines,1,'Default mobile/wide catch fits one line');
    assert.equal(data.width,'2400');assert.equal(data.height,'1350');
    assert.ok((width<=430?[640,960,1280]:[640,960,1440,1920]).includes(data.sourceWidth),'Selected responsive candidate is recorded at each DPR');
    if(width<=430&&dpr>=2)assert.equal(data.sourceWidth,1280,'High-density mobile keeps the original 1080px vertical resolution');
    assert.equal(data.loading,'eager');assert.equal(data.priority,'high');assert.ok(data.alt);
    assert.match(new URL(data.currentSrc).pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(avif|webp|jpg)$/);
    if(width<=430){assert.ok(data.updatesStart.y<height,'Update heading follows the hero in the tested mobile first viewport');assert.ok(data.firstUpdate.y<height,'First real update begins in the tested mobile first viewport');}
    assert.equal(await evaluate('document.querySelector(".mobile-menu-toggle").getAttribute("aria-expanded")'),'false');
    await audit('home introduction '+width+'/'+height+'/'+dpr);const catchContrast=await sampleCatchContrast();records.push({status:'decoded',...data,catchContrast});
    if((width===1440&&height===900)||width===393||width===1487||width===390)await screenshot('home-photo-'+width+'-'+height+'-dpr'+dpr+'.png');
  }
  // Meta points to the exact same social image on both platforms, without fetching production.
  const meta=await evaluate(`(()=>{const property=name=>document.querySelector('meta[property="'+name+'"]')?.content,name=value=>document.querySelector('meta[name="'+value+'"]')?.content;return{og:property('og:image'),twitter:name('twitter:image'),card:name('twitter:card'),width:property('og:image:width'),height:property('og:image:height'),alt:property('og:image:alt')}})()`);
  assert.equal(meta.card,'summary_large_image');assert.equal(meta.og,meta.twitter);assert.equal(meta.width,'1200');assert.equal(meta.height,'630');assert.ok(meta.alt);
  const socialUrl=new URL(meta.og);assert.equal(socialUrl.origin,'https://xpotato.net');
  assert.match(socialUrl.pathname,/^\/media\/v1\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.jpg$/);
  const socialResponse=await fetch(origin+socialUrl.pathname);assert.equal(socialResponse.status,200);assert.equal(socialResponse.headers.get('content-type'),'image/jpeg');records.push({status:'social-meta-local-asset-pass',...meta});
  const sampleHeaderContrast=async({enforce=true}={})=>{
    const logoResponse=await fetch(origin+'/xpotato-logo.svg');assert.equal(logoResponse.status,200);
    const logoColors=[...(await logoResponse.text()).matchAll(/fill="#([a-f0-9]{6})"/gi)].map(match=>[0,2,4].map(index=>parseInt(match[1].slice(index,index+2),16)));
    assert.ok(logoColors.length,'Logo has measurable solid fill colors');
    const samples=await evaluate(`(()=>{
      const targets=[];
      const add=(selector,kind)=>document.querySelectorAll(selector).forEach(node=>{
        const style=getComputedStyle(node),box=node.getBoundingClientRect();if(!box.width||!box.height)return;
        let r=box;
        if(kind==='text'&&node.firstChild?.nodeType===Node.TEXT_NODE){const range=document.createRange();range.selectNode(node.firstChild);r=range.getBoundingClientRect();}
        if(kind==='input')r={x:box.x+parseFloat(style.paddingLeft),y:box.y+parseFloat(style.paddingTop),width:Math.max(1,box.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)),height:parseFloat(style.lineHeight)};
        const color=kind==='input'?getComputedStyle(node,'::placeholder').color:style.color;
        targets.push({selector,kind,color,filter:style.filter,x:r.x,y:r.y,width:r.width,height:r.height});
      });
      add('.brand > span','text');add('.brand-domain','text');add('.desktop-navigation a','text');add('.header-search input','input');
      add('.brand img','logo');add('.mobile-search svg,.header-search button svg,.menu-icon','icon');
      window.__homeHeaderContrastRestore=[];
      for(const node of document.querySelectorAll('.brand > span,.brand-domain,.desktop-navigation a,.header-search input,.brand img,.mobile-search svg,.header-search button svg,.menu-icon')){
        window.__homeHeaderContrastRestore.push([node,node.getAttribute('style')]);
        if(node.matches('img,svg,.menu-icon'))node.style.visibility='hidden';else node.style.setProperty('-webkit-text-fill-color','transparent','important');
      }
      return{targets,viewportWidth:innerWidth,state:document.querySelector('.header-band').dataset.homeHeaderState};
    })()`);
    try{
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
      const capture=await send('Page.captureScreenshot',{format:'png'});
      const {data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const scale=info.width/samples.viewportWidth;
      const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const results=samples.targets.map(target=>{
        if(!enforce&&target.kind==='logo')return{selector:target.selector,kind:target.kind,status:'not-measured',filter:target.filter,reason:'Interpolated logo filter is recorded and shown in screenshots; no opaque endpoint color assumption is applied'};
        // Initial logo is CSS-inverted white; use its lightest real fill on the pale scrolled surface.
        const textLum=target.kind==='logo'? (samples.state==='top'?1:Math.max(...logoColors.map(luminance))):luminance(target.color.match(/[\d.]+/g).slice(0,3).map(Number));
        let minRatio=Infinity;
        for(let y=Math.max(0,Math.ceil(target.y*scale));y<Math.min(info.height,Math.floor((target.y+target.height)*scale));y++)for(let x=Math.max(0,Math.ceil(target.x*scale));x<Math.min(info.width,Math.floor((target.x+target.width)*scale));x++){
          const offset=(y*info.width+x)*info.channels,background=luminance([...data.subarray(offset,offset+3)]);
          minRatio=Math.min(minRatio,(Math.max(background,textLum)+.05)/(Math.min(background,textLum)+.05));
        }
        const required=['icon','logo'].includes(target.kind)?3:4.5;
        assert.ok(Number.isFinite(minRatio),'Header sample contains rendered pixels');
        if(enforce)assert.ok(minRatio>=required,'Header '+samples.state+' '+target.selector+' contrast '+minRatio+' requires '+required);
        return{selector:target.selector,kind:target.kind,minRatio,required,meetsThreshold:minRatio>=required};
      });
      return{state:samples.state,thresholdsEnforced:enforce,method:'minimum rendered background contrast over text/icon bounds with glyphs hidden using text-fill/visibility while preserving surfaces and color transitions',results};
    }finally{await evaluate(`(()=>{for(const [node,style] of window.__homeHeaderContrastRestore)style===null?node.removeAttribute('style'):node.setAttribute('style',style);delete window.__homeHeaderContrastRestore;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);}
  };
  const headerSnapshot=()=>evaluate(`(()=>{
    const h=document.querySelector('.header-band'),headerStyle=getComputedStyle(h),enhanced=h.hasAttribute('data-home-header-state'),s=getComputedStyle(h,'::before'),r=h.getBoundingClientRect();
    const boxes=[...document.querySelectorAll('.home-intro,#home-title,.home-catch,.home-projects')].map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y+scrollY,width:b.width,height:b.height}});
    return{state:h.dataset.homeHeaderState,position:headerStyle.position,surface:'::before',planeHeight:parseFloat(s.height),planeTop:parseFloat(s.top),headerBackground:headerStyle.backgroundColor,headerBackdrop:headerStyle.backdropFilter,background:s.backgroundColor,backdrop:s.backdropFilter,shadow:s.boxShadow,transition:s.transitionProperty,durations:s.transitionDuration,height:r.height,top:r.top,boxes,reserved:parseFloat(getComputedStyle(document.body).getPropertyValue('--site-header-height')),
      animations:document.querySelector('.home-intro').getAnimations({subtree:true}).length,
      obsolete:document.querySelectorAll('.home-title-japanese,.home-title-accessible,.home-display-settings').length,
      words:[...document.querySelectorAll('.home-title-static > span')].map(n=>n.textContent.trim()),hidden:document.querySelector('#home-title [aria-hidden="true"]')!==null};
  })()`);
  const scrollTo=async(y)=>{
    await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`);
    await until(()=>evaluate(`document.querySelector('.header-band').dataset.homeHeaderState===${JSON.stringify(y<=24?'top':'scrolled')} && document.querySelector('.header-band').getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle')`),'Header settled at '+y);
  };
  const stable=(before,after)=>{
    assert.equal(after.height,before.height,'Header geometry stays fixed');
    for(let i=0;i<before.boxes.length;i++)for(const key of ['x','y','width','height'])assert.ok(Math.abs(before.boxes[i][key]-after.boxes[i][key])<1,'No document-coordinate layout shift: '+i+'/'+key);
  };
  const key=async(name,code,number)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:number,...(name==='Enter'&&type==='keyDown'?{text:'\r'}:{})});};
  const menuAtPosition=async(y)=>{
    await scrollTo(y);
    await evaluate(`document.querySelector('.mobile-menu-toggle').focus({preventScroll:true})`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#site-menu').matches(':popover-open') && document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='true'`),'Menu opens at '+y);
    await key('Escape','Escape',27);
    await until(()=>evaluate(`!document.querySelector('#site-menu').matches(':popover-open') && document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='false'`),'Menu closes at '+y);
    assert.equal(await evaluate(`document.activeElement===document.querySelector('.mobile-menu-toggle')`),true);
    for(const count of [11,12,1]){
      const before=await evaluate(`document.querySelector('#site-menu').matches(':popover-open')`);
      await evaluate(`for(let i=0;i<${count};i++)document.querySelector('.mobile-menu-toggle').click()`);
      await until(()=>evaluate(`document.querySelector('#site-menu').matches(':popover-open')===${count%2?!before:before}`),'Repeated menu clicks at '+y);
    }
    await evaluate(`document.querySelector('.mobile-search').focus({preventScroll:true})`);await key('Enter','Enter',13);
    await until(()=>evaluate(`location.pathname==='/search/' && document.readyState==='complete'`),'Keyboard search at '+y);
    await navigate();
  };
  const verifyMenuGlass=async()=>{
    const results=[];
    for(const mode of ['popover','details'])for(const position of ['photo','light-content']){
      await navigate();
      const y=position==='photo'?0:await evaluate(`Math.ceil(document.querySelector('.home-projects').getBoundingClientRect().top+scrollY+100)`);
      await scrollTo(y);
      const selector=mode==='popover'?'#site-menu':'.mobile-menu-fallback nav',trigger=mode==='popover'?'.mobile-menu-toggle':'.mobile-menu-fallback summary';
      if(mode==='details')await evaluate(`document.querySelector('.mobile-menu-toggle').style.display='none';document.querySelector('.mobile-menu-fallback').style.display='block'`);
      await evaluate(`document.querySelector(${JSON.stringify(trigger)}).focus({preventScroll:true})`);await key('Enter','Enter',13);
      await until(()=>evaluate(`(()=>{const panel=document.querySelector(${JSON.stringify(selector)}),header=document.querySelector('.header-band');return getComputedStyle(panel).opacity==='1'&&getComputedStyle(panel.querySelector('ul')).opacity==='1'&&panel.getBoundingClientRect().height>0&&[...panel.getAnimations({subtree:true}),...header.getAnimations({subtree:true})].every(animation=>animation.playState==='finished'||animation.playState==='idle')})()`),'Settled glass menu '+mode+'/'+position);
      await key('Tab','Tab',9);
      assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector+' a')})&&document.activeElement.matches(':focus-visible')`),true,'Keyboard enters glass menu with visible focus');
      const sample=await evaluate(`(()=>{
        const panel=document.querySelector(${JSON.stringify(selector)}),h=document.querySelector('.header-band'),s=getComputedStyle(panel),hs=getComputedStyle(h),plane=getComputedStyle(h,'::before'),listStyle=getComputedStyle(panel.querySelector('ul')),box=panel.getBoundingClientRect();
        const targets=[...panel.querySelectorAll('a')].map(node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();return{color:getComputedStyle(node).color,text:node.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height}});
        window.__homeMenuContrastRestore=[...panel.querySelectorAll('a')].map(node=>[node,node.getAttribute('style')]);
        for(const [node] of window.__homeMenuContrastRestore)node.style.setProperty('color','transparent','important');
        return{targets,viewportWidth:innerWidth,listOpacity:listStyle.opacity,listDuration:listStyle.transitionDuration,listDelay:listStyle.transitionDelay,background:s.backgroundColor,backdrop:s.backdropFilter,headerBackground:hs.backgroundColor,headerBackdrop:hs.backdropFilter,headerBorder:hs.borderBottomColor,panelBorder:s.borderBottomColor,panelShadow:s.boxShadow,planeBackground:plane.backgroundColor,planeBackdrop:plane.backdropFilter,planeBottom:h.getBoundingClientRect().top+parseFloat(plane.top)+parseFloat(plane.height),top:box.top,bottom:box.bottom,headerBottom:h.getBoundingClientRect().bottom,viewportHeight:innerHeight};
      })()`);
      let contrast=[];
      try{
        assert.equal(sample.listOpacity,'1','Menu labels are fully visible before contrast sampling');assert.equal(parseFloat(sample.listDuration),0);assert.equal(parseFloat(sample.listDelay),0);
        assert.equal(sample.background,'rgba(0, 0, 0, 0)');assert.equal(sample.headerBackground,'rgba(0, 0, 0, 0)');assert.equal(sample.backdrop,'none');assert.equal(sample.headerBackdrop,'none');assert.equal(sample.panelShadow,'none');assert.notEqual(sample.planeBackdrop,'none','Only the shared pseudo-element owns the glass blur');assert.notEqual(sample.planeBackground,'rgba(0, 0, 0, 0)');
        assert.ok(Math.abs(sample.planeBottom-sample.bottom)<=1,'One material plane spans the header and whole menu without a seam');assert.equal(Number(sample.panelBorder.match(/[\d.]+/g)[3]),0);
        assert.ok(Math.abs(sample.top-sample.headerBottom)<=1,'Menu joins the header without an offset');assert.ok(sample.bottom<=sample.viewportHeight+1,'Menu fits the viewport');
        assert.equal(Number(sample.headerBorder.match(/[\d.]+/g)[3]),0,'Open menu removes the header seam');
        await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
        const capture=await send('Page.captureScreenshot',{format:'png'}),{data,info}=await sharp(Buffer.from(capture.data,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const scale=info.width/sample.viewportWidth,luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        contrast=sample.targets.map(target=>{
          const color=target.color.match(/[\d.]+/g).map(Number),alpha=color[3]??1;let minRatio=Infinity;
          for(let py=Math.max(0,Math.ceil(target.y*scale));py<Math.min(info.height,Math.floor((target.y+target.height)*scale));py++)for(let px=Math.max(0,Math.ceil(target.x*scale));px<Math.min(info.width,Math.floor((target.x+target.width)*scale));px++){
            const offset=(py*info.width+px)*info.channels,bg=[...data.subarray(offset,offset+3)],background=luminance(bg),foreground=luminance(bg.map((value,index)=>color[index]*alpha+value*(1-alpha)));
            minRatio=Math.min(minRatio,(Math.max(background,foreground)+.05)/(Math.min(background,foreground)+.05));
          }
          assert.ok(Number.isFinite(minRatio)&&minRatio>=4.5,'Menu '+mode+'/'+position+' '+target.text+' contrast '+minRatio);return{text:target.text,minRatio};
        });
      }finally{await evaluate(`(()=>{for(const [node,style] of window.__homeMenuContrastRestore)style===null?node.removeAttribute('style'):node.setAttribute('style',style);delete window.__homeMenuContrastRestore;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);}
      await screenshot('home-glass-menu-'+mode+'-'+position+'-390.png');await key('Escape','Escape',27);
      await until(()=>evaluate(`document.querySelector(${JSON.stringify(trigger)}).getAttribute('aria-expanded')==='false'`),'Glass menu Escape '+mode);
      assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(trigger)})`),true,'Escape restores glass menu trigger focus');
      assert.equal(await evaluate(`parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(selector+' > ul')})).transitionDelay)`),0,'Labels have no independent delay during the panel fade');
      results.push({mode,position,listOpacity:sample.listOpacity,listDuration:sample.listDuration,listDelay:sample.listDelay,panelBackground:sample.background,panelBackdrop:sample.backdrop,planeBackground:sample.planeBackground,planeBackdrop:sample.planeBackdrop,planeBottom:sample.planeBottom,menuBottom:sample.bottom,contrast});
    }
    await navigate();return{results,unsupportedBackdrop:'Opaque fallback source is asserted separately; this Chromium run does not emulate an unsupported backdrop-filter engine'};
  };
  const sampleHeaderTransition=async(width,top,scrolled)=>{
    const phases=[];
    for(const [direction,y,target] of [['to-glass',300,scrolled],['to-photo',0,top]]){
      try{
        const transitions=await evaluate(`(async()=>{
          const h=document.querySelector('.header-band');window.scrollTo({top:${y},behavior:'instant'});
          for(let frame=0;frame<60&&h.dataset.homeHeaderState!==${JSON.stringify(y?'scrolled':'top')};frame++)await new Promise(resolve=>requestAnimationFrame(resolve));
          if(h.dataset.homeHeaderState!==${JSON.stringify(y?'scrolled':'top')})throw Error('Header did not change state');
          getComputedStyle(h,'::before').backdropFilter;
          window.__homeHeaderTransitionSamples=h.getAnimations({subtree:true}).filter(animation=>'transitionProperty' in animation);
          for(const animation of window.__homeHeaderTransitionSamples){animation.pause();animation.currentTime=0;}
          return window.__homeHeaderTransitionSamples.map(animation=>({property:animation.transitionProperty,duration:Number(animation.effect.getTiming().duration),delay:Number(animation.effect.getTiming().delay)}));
        })()`);
        assert.ok(transitions.some(animation=>animation.property.includes('backdrop-filter')),'Real blur transition exists in '+direction);
        assert.ok(transitions.every(animation=>['color','filter'].includes(animation.property)?animation.duration===350&&animation.delay===175:animation.duration===700&&animation.delay===0),'Timeline preserves 700ms material and centered 350ms foreground with 175ms delay');
        assert.ok(transitions.some(animation=>animation.property==='background-color')&&transitions.some(animation=>animation.property==='color'),'Surface and foreground both animate as requested');
        for(const elapsedMs of [0,175,350,525,700]){
          await evaluate(`(()=>{for(const animation of window.__homeHeaderTransitionSamples)animation.currentTime=${elapsedMs};return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
          const frame=await headerSnapshot();stable(top,frame);
          assert.equal(frame.state,target.state);
          if(elapsedMs===700)assert.equal(frame.background,target.background,'Surface reaches its final state');
          const contrast=await sampleHeaderContrast({enforce:false});
          phases.push({direction,elapsedMs,transitions,background:frame.background,backdrop:frame.backdrop,shadow:frame.shadow,contrast});
          if(elapsedMs===350)await screenshot('home-header-'+direction+'-'+width+'-'+elapsedMs+'ms.png');
        }
        const directionPhases=phases.filter(phase=>phase.direction===direction);
        assert.ok(directionPhases.slice(1,-1).some(phase=>phase.backdrop!==directionPhases[0].backdrop&&phase.backdrop!==directionPhases.at(-1).backdrop),'Rendered blur has an intermediate phase in '+direction);
      }finally{
        await evaluate(`(()=>{for(const animation of window.__homeHeaderTransitionSamples??[])animation.finish();delete window.__homeHeaderTransitionSamples;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      }
    }
    const belowThreshold=phases.flatMap(phase=>phase.contrast.results.filter(result=>result.meetsThreshold===false).map(result=>({direction:phase.direction,elapsedMs:phase.elapsedMs,...result})));
    return{method:'Rendered samples of actual paused subtree CSS transitions at 0/175/350/525/700ms in both directions, retaining their declared 175ms foreground delay; finite samples do not establish contrast at every instant',assessment:'Transient contrast is measured, not a conformance pass. The user accepts temporary lower readability in exchange for a slower light/dark transition. Steady-state thresholds remain mandatory.',belowThreshold,phases};
  };
  for(const width of [320,390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await navigate();await scrollTo(0);
    const top=await headerSnapshot();
    assert.equal(top.position,'fixed');assert.equal(top.top,0);assert.equal(top.surface,'::before');assert.equal(top.headerBackdrop,'none');assert.equal(top.headerBackground,'rgba(0, 0, 0, 0)');assert.ok(Math.abs(top.planeHeight-top.height)<1,'Closed glass plane covers exactly the header');assert.ok(Math.abs(top.reserved-top.height)<1,'Measured header height reserves content space');
    assert.equal(top.animations,0,'Hero and photo have no animations');assert.equal(top.obsolete,0);assert.equal(top.hidden,false);assert.deepEqual(top.words,['Think.','Build.','Run.']);
    assert.equal(top.backdrop,'none','Initial header fuses with photo, without blur');
    assert.ok(top.transition.includes('backdrop-filter'),'Glass blur participates in smooth transition');
    assert.ok(top.transition.includes('background-color'),'Surface brightness transitions gradually');
    assert.ok(top.durations.split(',').every(value=>Math.abs(parseFloat(value)-.7)<.00001),'Header surface transition lasts 700ms');
    const topContrast=await sampleHeaderContrast();await screenshot('home-fused-header-'+width+'.png');await scrollTo(24);assert.equal((await headerSnapshot()).state,'top');await scrollTo(25);assert.equal((await headerSnapshot()).state,'scrolled');await scrollTo(300);
    const scrolled=await headerSnapshot();stable(top,scrolled);assert.notEqual(scrolled.backdrop,'none','Scrolled header uses backdrop glass');assert.notEqual(scrolled.background,top.background);
    const scrolledContrast=await sampleHeaderContrast();await screenshot('home-glass-header-'+width+'.png');await scrollTo(0);stable(top,await headerSnapshot());
    const transitionSamples=width===390||width===1440?await sampleHeaderTransition(width,top,scrolled):undefined;
    if(width<=390){await menuAtPosition(0);await menuAtPosition(300);}
    else for(const y of [0,300]){
      await scrollTo(y);await evaluate(`document.querySelector('#header-search-query').focus({preventScroll:true});document.querySelector('#header-search-query').value='test'`);await key('Enter','Enter',13);
      await until(()=>evaluate(`location.pathname==='/search/' && new URLSearchParams(location.search).get('q')==='test'`),'Desktop keyboard search at '+y);await navigate();
    }
    const menuGlass=width===390?await verifyMenuGlass():undefined;
    const menuTransition=width===390?await verifyHomeMenuTransition({evaluate,until,navigate}):undefined;
    records.push({status:'static-hero-fused-and-glass-header-layout-and-keyboard-pass',viewportWidth:width,top,scrolled,topContrast,scrolledContrast,transitionSamples,menuGlass,menuTransition});
  }
  records.push({status:'shared-header-across-content-routes-pass',routes:await verifySharedHeaderInteraction({send,evaluate,until,origin})});
  // Retain full native and details-fallback regression, including history restoration.
  await navigate();await verifyMenu();
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try{
    await navigate();
    assert.equal(await evaluate(`[...document.querySelectorAll('#site-menu > ul,.mobile-menu-fallback nav > ul')].every(list=>getComputedStyle(list).opacity==='1'&&parseFloat(getComputedStyle(list).transitionDelay)===0)`),true,'No-script menu labels are not hidden or delayed by enhanced entry styling');
    for(const y of [0,300]){
      await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`);const data=await headerSnapshot();
      assert.equal(data.position,'sticky');assert.equal(data.animations,0);assert.notEqual(data.background,'rgba(0, 0, 0, 0)','Without JS the header retains a readable background');assert.notEqual(data.background,'transparent');
    }
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:false});await navigate();
    await evaluate('document.documentElement.style.fontSize="200%";window.scrollTo(0,0)');
    assert.equal(await evaluate(`document.querySelector('#home-title').getBoundingClientRect().top>=document.querySelector('.header-band').getBoundingClientRect().bottom`),true,'No-script 200% text keeps the title below the natural-height header');
    records.push({status:'no-script-readable-header-static-hero-pass',textScale:200});
  }finally{await send('Emulation.setScriptExecutionDisabled',{value:false});}
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();
  for(const y of [0,300]){await scrollTo(y);const data=await headerSnapshot();assert.equal(data.animations,0);assert.ok(await evaluate(`(()=>{const header=document.querySelector('.header-band'),nodes=[header,...header.querySelectorAll('*')],styles=[...nodes.map(node=>getComputedStyle(node)),getComputedStyle(header,'::before')],input=header.querySelector('input');if(input)styles.push(getComputedStyle(input,'::placeholder'));return styles.every(style=>[...style.transitionDuration.split(','),...style.transitionDelay.split(',')].every(value=>parseFloat(value)<=.00001))})()`),'Reduced motion disables header, foreground, logo and placeholder transitions and delays');}
  records.push({status:'reduced-motion-static-hero-and-header-pass'});
  await send('Emulation.setEmulatedMedia',{features:[]});await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await navigate();
  const before=await snapshot();
  try {
    setFailure(true);await navigate();
    await until(() => evaluate('document.querySelector(".workshop-photo img").complete && document.querySelector(".workshop-photo img").naturalWidth === 0'), 'Test-only unavailable photo');
    const failure=await snapshot();validateLayout(failure);assert.deepEqual(failure.hero,before.hero,'Image failure must retain layout');assert.deepEqual(failure.projects,before.projects);
    assert.equal(failure.background,'rgb(38, 38, 42)');await audit('mobile unavailable photo');await screenshot('home-photo-unavailable.png');await verifyMenu();records.push({status:'503-fallback-menu-pass',...failure});
  } finally { setFailure(false); }
  for(const width of [320,375,390,393,430,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await navigate();await evaluate('document.documentElement.style.fontSize="200%"');
    const data=await snapshot();validateLayout(data);await audit('home introduction '+width+'/200');records.push({textScale:200,status:'home-reflow-pass',...data});
    if(width===320)await screenshot('home-introduction-320-200.png');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await navigate();
  const history=await send('Page.getNavigationHistory'),entryId=history.entries[history.currentIndex].id;
  const navigationKey=async(key,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,modifiers,windowsVirtualKeyCode:key==='Tab'?9:13,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});};
  await evaluate(`document.querySelector('.site-footer a[href="/about/"]').focus()`);await navigationKey('Tab',8);await navigationKey('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/about/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0'),true,'Footer about link focus visible');
  await navigationKey('Enter');await until(()=>evaluate('location.pathname==="/about/"&&document.readyState==="complete"'),'Footer about navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".site-footer"))'),'Back to homepage');
  await evaluate(`document.querySelector('.site-footer').scrollIntoView();document.querySelector('.site-footer a[href="/contact/"]').focus()`);await navigationKey('Tab',8);await navigationKey('Tab');
  assert.equal(await evaluate('document.activeElement.pathname'),'/contact/');
  assert.equal(await evaluate('document.activeElement.matches(":focus-visible")'),true);await screenshot('home-footer-contact-390.png');await navigationKey('Enter');
  await until(()=>evaluate('location.pathname==="/contact/"&&document.readyState==="complete"&&Boolean(document.querySelector("[data-contact-details]"))'),'Footer contact navigation');
  await send('Page.navigateToHistoryEntry',{entryId});await until(()=>evaluate('location.pathname==="/"&&document.readyState==="complete"&&Boolean(document.querySelector(".site-footer"))'),'Back from contact');
  records.push({status:'footer-about-contact-keyboard-navigation-and-back-pass'});
  await send('Emulation.setDeviceMetricsOverride',{width:1487,height:1058,deviceScaleFactor:1,mobile:false});await navigate();
  await until(() => evaluate('document.querySelector(".workshop-photo img").naturalWidth > 0'), 'Photo restored after synthetic failure');
  records.push(...await verifyHomeToolRows({send,evaluate,until,origin,audit,screenshot}));
  return records;
}
