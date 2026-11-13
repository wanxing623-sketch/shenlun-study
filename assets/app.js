/* ============================================================
   申论词库 · 主程序
   目录：1 基础与状态  2 浮层与导航  3 首页  4 规范词  5 对策
        6 案例  7 公文  8 复习  9 设置  10 搜索
        之后是：批改引擎 → 真题 → 参考答案
   ============================================================ */
(function(){
 /* ---------- 1. 基础与状态 ---------- */
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const ico=window.ico||(()=>'');
 /* 无痕模式下 localStorage 可能不可用，退回内存存储，保证页面照常能用 */
 const LS=(()=>{try{const t="__sh_t";localStorage.setItem(t,"1");localStorage.removeItem(t);return localStorage}catch(e){const m={};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]},key:i=>Object.keys(m)[i]||null,get length(){return Object.keys(m).length}}}})();
 window.__LS=LS;
 const readJSON=(k,d)=>{try{const v=JSON.parse(LS.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
 const LIB=['vocab','strategy','cases','format'];
 const viewNames={dashboard:'首页',vocab:'规范词',strategy:'对策',cases:'案例',format:'公文',workspace:'真题',lab:'练习',review:'复习',settings:'设置'};
 const TYPE_LABEL={vocab:'规范词',strategy:'对策',problem:'问题',case:'案例'};
 const state={
   view:'dashboard',libView:LIB.includes(LS.getItem('sh_lib_last'))?LS.getItem('sh_lib_last'):'vocab',
   vocabFilter:'全部',vocabQuery:'',vocabPeriod:'all',vocabFav:false,vocabLimit:60,vocabOrder:[],selectedVocab:null,
   strategyFilter:'全部',strategyQuery:'',strategyFav:false,strategyMode:'strategy',strategyOrder:[],selectedStrategy:null,selectedProblem:null,
   caseChapter:'all',caseSection:'all',caseQuery:'',caseFav:false,caseLimit:40,caseOrder:[],selectedCase:null,
   formatIndex:0,practiceMode:'vocab',practiceIndex:0,practiceAnswered:false,reviewTab:'due',
   recent:readJSON('sh_recent',[]),favorites:readJSON('sh_favorites',{}),mastery:readJSON('sh_mastery',{}),plan:readJSON('sh_plan',[])
 };
 const scrollPos={};
 function save(){LS.setItem('sh_favorites',JSON.stringify(state.favorites));LS.setItem('sh_recent',JSON.stringify(state.recent.slice(0,8)));LS.setItem('sh_mastery',JSON.stringify(state.mastery));LS.setItem('sh_plan',JSON.stringify(state.plan))}
 function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
 function hi(x,q){q=(q||'').trim();if(!q)return esc(x);return esc(x).replace(new RegExp('('+esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>')}
 const key=(type,id)=>type+':'+id;
 const isFav=(type,id)=>!!state.favorites[key(type,id)];
 const starBtn=(type,id)=>{const on=isFav(type,id);return `<button class="star${on?' on':''}" data-fav="${type}:${id}" aria-label="收藏" aria-pressed="${on}">${ico('star')}</button>`};
 const periodName=p=>String(p||'').replace('规范词积累','').replace('（答案版）','');
 const chapterName=c=>String(c||'').replace(/^第.{1,3}章\s*/,'');
 const sectionName=s=>String(s||'').replace(/^第.{1,3}节\s*/,'');
 const strategyById=id=>DATA.strategies.find(s=>s.id===id);
 const problemById=id=>PROBLEMS.find(p=>p.id===id);

 function toast(msg){const el=$('#toast');if(!el)return;const m=String(msg);/* 同一句提示 1.5 秒内只出现一次 */if(window.__toastMsg===m&&Date.now()-(window.__toastAt||0)<1500)return;window.__toastMsg=m;window.__toastAt=Date.now();el.textContent=m;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),1800)}
 function appConfirm(msg,onOk,okText){
   let ov=document.getElementById('app-confirm');
   if(!ov){
     ov=document.createElement('div');ov.id='app-confirm';ov.hidden=true;
     ov.innerHTML='<div class="ac-mask"></div><div class="ac-box" role="alertdialog" aria-modal="true"><p class="ac-msg"></p><div class="ac-btns"><button class="ac-btn no">取消</button><button class="ac-btn yes">确定</button></div></div>';
     document.body.appendChild(ov);
   }
   ov.querySelector('.ac-msg').textContent=msg;
   ov.querySelector('.ac-btn.yes').textContent=okText||'确定';
   ov.hidden=false;requestAnimationFrame(()=>ov.classList.add('show'));
   const done=ok=>{ov.classList.remove('show');setTimeout(()=>{ov.hidden=true},190);if(ok&&onOk)onOk()};
   ov.querySelector('.ac-btn.no').onclick=()=>done(false);
   ov.querySelector('.ac-mask').onclick=()=>done(false);
   ov.querySelector('.ac-btn.yes').onclick=()=>done(true);
 }
 function copy(text,okMsg){const ok=()=>toast(okMsg||'已复制'),fail=()=>toast('复制失败，请长按文字手动复制');const legacy=()=>{try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const r=document.execCommand('copy');document.body.removeChild(ta);r?ok():fail()}catch(e){fail()}};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(legacy)}else legacy()}

 function toggleFav(type,id){
   const k=key(type,id),on=!state.favorites[k];
   if(on)state.favorites[k]={type,id};else delete state.favorites[k];
   save();
   /* 就地更新星标，不重排整张列表，手指下的内容不会跳 */
   $$('[data-fav="'+k+'"]').forEach(b=>{b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
   if(state.view==='review'||(state.view==='vocab'&&state.vocabFav)||(state.view==='strategy'&&state.strategyFav)||(state.view==='cases'&&state.caseFav))renderAll();
   refreshDetail();
   toast(on?'已收藏':'已取消收藏');
 }
 function setMastery(id,level){
   if(state.mastery[id]===level)delete state.mastery[id];else state.mastery[id]=level;
   save();renderAll();refreshDetail();
   toast(state.mastery[id]===2?'已标为掌握':state.mastery[id]===1?'已加入待复习':'已取消标记');
 }
 function addRecent(type,id,title,sub){state.recent=[{type,id,title,sub},...state.recent.filter(x=>!(x.type===type&&String(x.id)===String(id)))].slice(0,8);save()}
 function refreshDetail(){
   if(state.view==='vocab'&&state.selectedVocab!=null)renderVocabDetail(state.selectedVocab);
   if(state.view==='strategy'){
     if(state.strategyMode==='problem'&&state.selectedProblem!=null)renderProblemDetail(state.selectedProblem);
     else if(state.strategyMode==='strategy'&&state.selectedStrategy!=null)renderStrategyDetail(state.selectedStrategy);
   }
   if(state.selectedCase!=null&&$('#case-drawer').classList.contains('open'))renderCaseDetail(state.selectedCase);
 }
 function renderAll(){
   const v=state.view;
   if(v==='dashboard')renderDashboard();if(v==='vocab')renderVocab();if(v==='strategy')renderStrategy();if(v==='cases')renderCases();
   if(v==='format')renderFormat();if(v==='review')renderReview();if(v==='settings')renderSettings();if(v==='workspace')renderWorkspace();
 }
 /* 详情里的「上一条 / 下一条」：在抽屉里连续翻看，不用反复关开 */
 function navRow(order,id){
   const i=order.indexOf(id);if(i<0||order.length<2)return'';
   return `<div class="detail-nav"><button data-nav="${i>0?order[i-1]:''}" ${i<=0?'disabled':''}>${ico('left')}上一条</button><span>${i+1} / ${order.length}</span><button data-nav="${i<order.length-1?order[i+1]:''}" ${i>=order.length-1?'disabled':''}>下一条${ico('right')}</button></div>`;
 }
 const sheetCloseBtn=()=>`<button class="sheet-close" data-sheet-close aria-label="关闭">${ico('x')}</button>`;

 /* ---------- 2. 浮层与导航 ---------- */
 const mqSheet=window.matchMedia?matchMedia('(max-width:1023px)'):{matches:false};
 const root=document.documentElement;
 let sheetEl=null;
 function openSheet(el){
   if(!el||!mqSheet.matches)return;
   if(sheetEl&&sheetEl!==el)sheetEl.classList.remove('open');
   sheetEl=el;el.style.transform='';el.classList.add('open');el.scrollTop=0;
   $('#sheet-scrim').classList.add('show');root.classList.add('sheet-open');
 }
 function closeSheet(){
   if(!sheetEl)return false;
   sheetEl.style.transform='';sheetEl.classList.remove('open');sheetEl=null;
   $('#sheet-scrim').classList.remove('show');root.classList.remove('sheet-open');
   return true;
 }
 $('#sheet-scrim').addEventListener('click',closeSheet);
 document.addEventListener('click',e=>{if(e.target.closest('[data-sheet-close]'))closeSheet()});
 function closeDrawer(){const d=$('#case-drawer');if(!d.classList.contains('open'))return false;d.classList.remove('open');d.querySelector('.drawer').style.transform='';root.classList.remove('sheet-open');return true}
 $('#drawer-close').onclick=closeDrawer;$('#drawer-back').onclick=closeDrawer;
 /* 抽屉顶部往下拖可以关闭（只在顶部 56px 内起手，避免和内容滚动打架） */
 function dragToClose(el,closeFn){
   let y0=null,dy=0;
   el.addEventListener('touchstart',e=>{
     if(!mqSheet.matches||e.touches.length!==1)return;
     const r=el.getBoundingClientRect();
     if(e.touches[0].clientY-r.top>56||el.scrollTop>0)return;
     y0=e.touches[0].clientY;dy=0;el.style.transition='none';
   },{passive:true});
   el.addEventListener('touchmove',e=>{
     if(y0==null)return;
     dy=Math.max(0,e.touches[0].clientY-y0);el.style.transform='translateY('+dy+'px)';
   },{passive:true});
   const end=()=>{
     if(y0==null)return;y0=null;el.style.transition='';
     if(dy>90)closeFn();else el.style.transform='';
     dy=0;
   };
   el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);
 }
 $$('.detail-panel').forEach(p=>dragToClose(p,closeSheet));
 dragToClose($('#case-drawer .drawer'),closeDrawer);

 const searchWrap=$('#search-box');
 function openSearch(){searchWrap.classList.add('open');const i=$('#global-search');i.focus();globalSearch(i.value)}
 function closeSearch(){const was=searchWrap.classList.contains('open')||$('#global-results').classList.contains('open');searchWrap.classList.remove('open');$('#global-results').classList.remove('open');const i=$('#global-search');if(document.activeElement===i)i.blur();return was}
 /* 返回键 / Esc：先关最上面一层浮层，没有浮层才真正返回 */
 function closeTopLayer(){
   const ac=document.getElementById('app-confirm');if(ac&&!ac.hidden){ac.querySelector('.ac-btn.no').click();return true}
   if(searchWrap.classList.contains('open')){closeSearch();return true}
   if(!$('#ws-ref').hidden){wsRefClose();return true}
   if(!$('#ws-grade').hidden){wsModalClose();return true}
   if(!$('#ws-picker').hidden){wsPickerClose();return true}
   if(closeDrawer())return true;
   if(closeSheet())return true;
   return false;
 }
 function pushView(view,replace){try{if(replace)history.replaceState({v:view},'','#'+view);else history.pushState({v:view},'','#'+view)}catch(e){}}
 window.addEventListener('popstate',e=>{
   if(closeTopLayer()){pushView(state.view);return}
   const v=(e.state&&e.state.v)||(location.hash||'').slice(1);
   openView(viewNames[v]?v:'dashboard',{fromHistory:true});
 });

 function openView(view,opt){
   opt=opt||{};
   if(!viewNames[view])view='dashboard';
   const prev=state.view,changed=prev!==view;
   if(changed)scrollPos[prev]=window.scrollY||0;
   closeDrawer();closeSheet();closeSearch();
   state.view=view;
   const inLib=LIB.includes(view);
   if(inLib){state.libView=view;LS.setItem('sh_lib_last',view)}
   $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
   $$('.nav button').forEach(b=>{const on=b.dataset.view===view;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
   $$('.tabbar button').forEach(b=>{const on=b.dataset.tab==='library'?inLib:b.dataset.view===view;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
   $('#libnav').hidden=!inLib;
   $$('#libnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
   $('#settings-btn').classList.toggle('active',view==='settings');
   $('#page-title').textContent=inLib?'资料':viewNames[view];
   document.title=view==='dashboard'?'申论词库':viewNames[view]+' · 申论词库';
   document.body.dataset.view=view;
   if(view==='dashboard')renderDashboard();if(view==='vocab')renderVocab();if(view==='strategy')renderStrategy();if(view==='cases')renderCases();
   if(view==='format')renderFormat();if(view==='review')renderReview();if(view==='settings')renderSettings();if(view==='workspace')renderWorkspace();
   if(view==='lab'&&window.SH_LABHOOK)SH_LABHOOK.render();
   if(window.SH_WSFLOAT)window.SH_WSFLOAT();
   if(window.SH_LABHOOK&&SH_LABHOOK.syncFloat)SH_LABHOOK.syncFloat();
   if(changed){
     if(!opt.fromHistory)pushView(view);
     /* 每个页面记住自己的滚动位置，切回来还在原处 */
     const y=opt.top?0:(scrollPos[view]||0);
     window.scrollTo(0,y);if(y)requestAnimationFrame(()=>window.scrollTo(0,y));
   }
 }
 const toTop=()=>window.scrollTo({top:0,behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth'});
 $$('.nav button').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
 $$('#libnav button').forEach(b=>b.addEventListener('click',()=>{if(state.view===b.dataset.view)toTop();else openView(b.dataset.view,{top:true})}));
 $$('.tabbar button').forEach(b=>b.addEventListener('click',()=>{
   const target=b.dataset.tab==='library'?state.libView:b.dataset.view;
   /* 再点一次当前标签：回到顶部 */
   if(state.view===target||(b.dataset.tab==='library'&&LIB.includes(state.view))){toTop();return}
   openView(target);
 }));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;e.preventDefault();openView(b.dataset.go)});
 $('#collapse-btn').addEventListener('click',()=>{const on=$('#sidebar').classList.toggle('collapsed');LS.setItem('sh_side',on?'1':'0')});
 if(LS.getItem('sh_side')==='1')$('#sidebar').classList.add('collapsed');
 $('#theme-btn').addEventListener('click',()=>{const cur=root.getAttribute('data-theme');LS.setItem('sh_theme',cur==='dark'?'light':'dark');applyTheme()});
 document.addEventListener('keydown',e=>{
   const tag=document.activeElement&&document.activeElement.tagName,typing=['INPUT','TEXTAREA','SELECT'].includes(tag);
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#global-search').focus();return}
   if(e.key==='/'&&!typing){e.preventDefault();$('#global-search').focus();return}
   if(e.key==='Escape'){closeTopLayer();return}
   if(!typing&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&/^[1-9]$/.test(e.key)){openView(['dashboard','vocab','strategy','cases','format','workspace','lab','review','settings'][+e.key-1])}
 });
 /* 顶栏下方的分隔线只在滚动后出现 */
 let scrolledOn=false;
 window.addEventListener('scroll',()=>{const on=(window.scrollY||0)>4;if(on!==scrolledOn){scrolledOn=on;document.body.classList.toggle('scrolled',on)}},{passive:true});
 /* 软键盘弹出时收起底栏，把高度让给输入区 */
 if(window.visualViewport){
   const vv=window.visualViewport,kb=()=>document.body.classList.toggle('kb-open',window.innerHeight-vv.height>140);
   vv.addEventListener('resize',kb);
 }

 /* ---------- 3. 首页 ---------- */
 function randomAny(){
   const type=['vocab','strategy','case'][Math.floor(Math.random()*3)];
   if(type==='vocab'){openView('vocab');selectVocab(Math.floor(Math.random()*DATA.vocab.length))}
   else if(type==='strategy'){state.strategyMode='strategy';openView('strategy');selectStrategy(DATA.strategies[Math.floor(Math.random()*DATA.strategies.length)].id)}
   else{openView('cases');openCase(Math.floor(Math.random()*DATA.cases.length))}
 }
 $('#random-btn').addEventListener('click',randomAny);
 function openRecent(type,id){
   if(type==='vocab'){openView('vocab');selectVocab(+id)}
   else if(type==='strategy'){state.strategyMode='strategy';openView('strategy');selectStrategy(+id)}
   else if(type==='problem'){state.strategyMode='problem';openView('strategy');selectProblem(+id)}
   else{openView('cases');const ci=DATA.cases.findIndex(x=>x.title===id);if(ci>=0)openCase(ci)}
 }
 function renderDashboard(){
   const d=new Date(),hr=d.getHours();
   $('#dash-greet').textContent=hr<5?'夜深了':hr<11?'早上好':hr<13?'中午好':hr<18?'下午好':'晚上好';
   $('#dash-date').textContent=(d.getMonth()+1)+'月'+d.getDate()+'日 · 周'+'日一二三四五六'[d.getDay()];
   $('#stat-vocab').textContent=DATA.vocab.length+' 条';
   $('#stat-strategy').textContent=DATA.strategies.length+' 条模板';
   $('#stat-cases').textContent=DATA.cases.length+' 条';
   $('#stat-format').textContent=FORMATS.length+' 种文种';
   /* 继续上次的卷子 */
   const idx=window.SH_EXAM_INDEX||[],lastId=LS.getItem('sh_ws_last'),meta=idx.find(x=>x.id===lastId);
   if(meta){
     const total=wsQCount(meta),ans=(readJSON('sh_ws_ans',{})[meta.id])||{};
     const done=Math.min(total,Object.keys(ans).filter(k=>String(ans[k]||'').replace(/\s/g,'').length>0).length);
     $('#resume-kicker').textContent=done?'继续做题':'上次打开';
     $('#resume-name').textContent=meta.r+' '+meta.y+(meta.l?' · '+meta.l:'');
     $('#resume-meta').textContent=(done?'已答 '+done+' / '+total+' 题':'共 '+total+' 题')+' · 材料 '+(meta.c/10000).toFixed(1)+' 万字';
     $('#resume-prog').innerHTML=Array.from({length:total},(_,i)=>'<i'+(i<done?' class="on"':'')+'></i>').join('');
   }else{
     $('#resume-kicker').textContent='真题';
     $('#resume-name').textContent='选一套真题开始';
     $('#resume-meta').textContent=idx.length?idx.length+' 套 · 国考与各省省考':'';
     $('#resume-prog').innerHTML='';
   }
   /* 今天 */
   const lv=Object.keys(state.mastery).map(k=>state.mastery[k]),mastered=lv.filter(x=>x===2).length,weak=lv.filter(x=>x===1).length;
   const labRec=Object.keys((readJSON('sh_lab_v1',{})||{}).rec||{}).length;
   const rows=[
     {act:'train',ic:'review',t:'规范词快练',s:weak?weak+' 条标了不熟，先练这些':mastered?'已掌握 '+mastered+' / '+DATA.vocab.length:'一组 10 题，两三分钟',side:weak?String(weak):''},
     {act:'lab',ic:'lab',t:'分项练习',s:labRec?'已练 '+labRec+' 题 · 小题、大作文、分论点':'小题、大作文、分论点'},
     {act:'random',ic:'shuffle',t:'随便看一条',s:'从规范词、对策和案例里抽'}
   ];
   $('#dash-today').innerHTML=rows.map(r=>`<button class="row" data-act="${r.act}">${ico(r.ic)}<span class="row-main"><b>${r.t}</b><span>${esc(r.s)}</span></span>${r.side?`<span class="row-side hot">${r.side}</span>`:''}${ico('right')}</button>`).join('');
   /* 最近看过 */
   const el=$('#recent-list');
   $('#recent-clear').hidden=!state.recent.length;
   el.innerHTML=state.recent.length?state.recent.slice(0,6).map((x,i)=>`<button class="row" data-recent="${i}"><span class="row-main"><b>${esc(x.title)}</b><span>${esc(x.sub||'')}</span></span><span class="row-side">${TYPE_LABEL[x.type]||'案例'}</span></button>`).join(''):'<div class="row-empty">看过的词条会出现在这里。</div>';
 }
 $('#dash-today').addEventListener('click',e=>{
   const b=e.target.closest('[data-act]');if(!b)return;
   if(b.dataset.act==='train'){openView('review',{top:true});startTraining()}
   else if(b.dataset.act==='lab')openView('lab');
   else randomAny();
 });
 $('#recent-list').addEventListener('click',e=>{const b=e.target.closest('[data-recent]');if(!b)return;const x=state.recent[+b.dataset.recent];if(x)openRecent(x.type,x.id)});
 $('#recent-clear').addEventListener('click',()=>{state.recent=[];save();renderDashboard()});

 /* 列表卡片的点击统一用事件委托：收藏、打开详情、键盘回车 */
 function bindList(sel,attr,open){
   const el=$(sel);
   el.addEventListener('click',e=>{
     const fav=e.target.closest('[data-fav]');
     if(fav){const p=fav.dataset.fav.split(':');toggleFav(p[0],+p[1]);return}
     const c=e.target.closest('['+attr+']');if(c)open(+c.getAttribute(attr),c);
   });
   el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.hasAttribute&&e.target.hasAttribute(attr)){e.preventDefault();open(+e.target.getAttribute(attr),e.target)}});
 }
 function bindDetail(sel,handlers){
   $(sel).addEventListener('click',e=>{
     const nav=e.target.closest('[data-nav]');
     if(nav){if(nav.dataset.nav!=='')handlers.nav(+nav.dataset.nav);return}
     const b=e.target.closest('[data-do]');if(b&&handlers[b.dataset.do])handlers[b.dataset.do](b);
   });
 }
 const favOnlyBtn=(sel,on)=>{const b=$(sel);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)};

 /* ---------- 4. 规范词 ---------- */
 const VOCAB_CATS=['全部','治理与执法','产业与发展','文化与文旅','乡村与生态','民生与服务','科技与创新'];
 function vocabCat(x){const s=x.term+x.scene;if(/执法|治理|监管|诉求|共治|问责|矛盾|法治|依法|信用|投诉/.test(s))return'治理与执法';if(/产业|企业|产品|品牌|消费|就业|经营|经济|市场|制造/.test(s))return'产业与发展';if(/文化|文旅|非遗|传统|阅读|旅游|艺术/.test(s))return'文化与文旅';if(/乡村|农业|农民|生态|绿色|环境|资源|水/.test(s))return'乡村与生态';if(/科技|数字|智能|技术|创新|自动化|平台|数据/.test(s))return'科技与创新';return'民生与服务'}
 (function(){const periods=[...new Set(DATA.vocab.map(x=>x.period))];$('#vocab-period').innerHTML='<option value="all">全部期数</option>'+periods.map(p=>{const t=esc(periodName(p));return `<option value="${t}">${t}</option>`}).join('')})();
 function renderVocab(){
   $('#vocab-chips').innerHTML=VOCAB_CATS.map(x=>`<button class="chip${state.vocabFilter===x?' active':''}" data-vchip="${x}">${x}</button>`).join('');
   favOnlyBtn('#vocab-fav-only',state.vocabFav);
   const q=state.vocabQuery.trim().toLowerCase(),sort=$('#vocab-sort').value;
   let arr=DATA.vocab.map((x,i)=>Object.assign({},x,{id:i})).filter(x=>(state.vocabFilter==='全部'||vocabCat(x)===state.vocabFilter)&&(state.vocabPeriod==='all'||periodName(x.period)===state.vocabPeriod)&&(!state.vocabFav||isFav('vocab',x.id))&&(!q||(x.scene+x.term).toLowerCase().includes(q)));
   if(sort==='term')arr.sort((a,b)=>a.term.localeCompare(b.term,'zh'));
   if(sort==='scene')arr.sort((a,b)=>a.scene.localeCompare(b.scene,'zh'));
   state.vocabOrder=arr.map(x=>x.id);
   $('#vocab-count').textContent=arr.length===DATA.vocab.length?'共 '+arr.length+' 条':arr.length+' / '+DATA.vocab.length+' 条';
   $('#vocab-list').innerHTML=arr.length?arr.slice(0,state.vocabLimit).map(x=>{
     const m=state.mastery[x.id];
     return `<article class="data-card${state.selectedVocab===x.id?' selected':''}" data-vocab="${x.id}" tabindex="0" role="button"><div class="card-main"><div class="card-title">${hi(x.term,q)}</div><p>${hi(x.scene,q)}</p><div class="card-meta"><span>${vocabCat(x)}</span><span>${esc(periodName(x.period))}</span>${m===2?'<span class="st-ok">已掌握</span>':m===1?'<span class="st-due">待复习</span>':''}</div></div>${starBtn('vocab',x.id)}</article>`;
   }).join('')+(arr.length>state.vocabLimit?`<button class="load-more" data-more>再显示 ${Math.min(60,arr.length-state.vocabLimit)} 条（还有 ${arr.length-state.vocabLimit} 条）</button>`:'')
   :`<div class="empty">${state.vocabFav&&!q?'还没有收藏的规范词。点词条右侧的星标就能收藏。':'没有找到。换个更短的词试试。'}</div>`;
 }
 function renderVocabDetail(id){
   const x=DATA.vocab[id];if(!x)return;const m=state.mastery[id],fav=isFav('vocab',id);
   $('#vocab-detail').innerHTML=sheetCloseBtn()+`<div class="detail-kicker">规范词 · ${esc(periodName(x.period))} · ${vocabCat(x)}</div><h2>${esc(x.term)}</h2><div class="detail-label">材料原句</div><div class="quote-text">${esc(x.scene)}</div>`
     +`<div class="detail-actions"><button class="is-primary" data-do="copy">${ico('copy')}复制</button><button class="${fav?'is-on':''}" data-do="fav">${ico('star')}${fav?'已收藏':'收藏'}</button></div>`
     +`<div class="mastery"><span>掌握程度</span><span class="segmented"><button class="${m===1?'active':''}" data-do="m1">还不熟</button><button class="${m===2?'active':''}" data-do="m2">已掌握</button></span></div>`
     +navRow(state.vocabOrder,id);
 }
 function selectVocab(id){
   const x=DATA.vocab[id];if(!x)return;
   state.selectedVocab=id;addRecent('vocab',id,x.term,periodName(x.period));
   $$('#vocab-list .data-card').forEach(c=>c.classList.toggle('selected',+c.dataset.vocab===id));
   renderVocabDetail(id);openSheet($('#vocab-detail'));
 }
 bindList('#vocab-list','data-vocab',selectVocab);
 $('#vocab-list').addEventListener('click',e=>{if(e.target.closest('[data-more]')){state.vocabLimit+=60;renderVocab()}});
 bindDetail('#vocab-detail',{
   nav:selectVocab,
   copy:()=>copy(DATA.vocab[state.selectedVocab].term),
   fav:()=>toggleFav('vocab',state.selectedVocab),
   m1:()=>setMastery(state.selectedVocab,1),
   m2:()=>setMastery(state.selectedVocab,2)
 });
 $('#vocab-chips').addEventListener('click',e=>{const b=e.target.closest('[data-vchip]');if(!b)return;state.vocabFilter=b.dataset.vchip;state.vocabLimit=60;renderVocab()});
 $('#vocab-search').addEventListener('input',e=>{state.vocabQuery=e.target.value;state.vocabLimit=60;renderVocab()});
 $('#vocab-period').addEventListener('change',e=>{state.vocabPeriod=e.target.value;state.vocabLimit=60;renderVocab()});
 $('#vocab-sort').addEventListener('change',renderVocab);
 $('#vocab-fav-only').addEventListener('click',()=>{state.vocabFav=!state.vocabFav;renderVocab()});
 $('#vocab-random').addEventListener('click',()=>{const o=state.vocabOrder.length?state.vocabOrder:DATA.vocab.map((x,i)=>i);selectVocab(o[Math.floor(Math.random()*o.length)])});

 /* ---------- 5. 对策（对策模板 + 问题表述） ---------- */
 function renderPlan(){
   const bar=$('#plan-bar');if(!bar)return;
   const items=state.plan.map(strategyById).filter(Boolean);
   bar.hidden=state.strategyMode==='problem'||!items.length;
   if(bar.hidden){bar.innerHTML='';return}
   bar.innerHTML='<span class="plan-label">组合</span>'+items.map(x=>`<span class="plan-chip">${esc(x.title)}<button data-remove-plan="${x.id}" aria-label="移除 ${esc(x.title)}">${ico('x')}</button></span>`).join('')+(items.length>=2?'<button class="plan-action" data-plan-copy>合成一段并复制</button>':'<span class="plan-tip">再加 1 条就能合成一段</span>');
 }
 $('#plan-bar').addEventListener('click',e=>{
   const rm=e.target.closest('[data-remove-plan]');
   if(rm){state.plan=state.plan.filter(id=>id!==+rm.dataset.removePlan);save();renderPlan();refreshDetail();return}
   if(e.target.closest('[data-plan-copy]')){const items=state.plan.map(strategyById).filter(Boolean);copy(items.map(x=>x.text.replace(/\.\.\.|……/g,'该领域').replace(/[。；;]\s*$/,'')).join('；')+'。','已合成一段并复制')}
 });
 function togglePlan(id){
   if(state.plan.includes(id)){state.plan=state.plan.filter(x=>x!==id);toast('已移出组合')}
   else{if(state.plan.length>=4){toast('一次最多组合 4 条');return}state.plan.push(id);toast('已加入组合')}
   save();renderPlan();refreshDetail();
 }
 function renderStrategy(){
   const isP=state.strategyMode==='problem',items=isP?PROBLEMS:DATA.strategies,type=isP?'problem':'strategy';
   const c1=$('[data-smode="strategy"] b'),c2=$('[data-smode="problem"] b');if(c1)c1.textContent=DATA.strategies.length;if(c2)c2.textContent=PROBLEMS.length;
   $$('[data-smode]').forEach(b=>{const on=b.dataset.smode===state.strategyMode;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});
   $('#strategy-intro').textContent=isP?'材料里的现象怎么写成规范的问题表述，每条都对应着可用的对策。':'按治理动作分成 9 类。把模板里的省略号换成题目的对象就能用。';
   $('#strategy-search').placeholder=isP?'搜索问题、表述或材料里的说法':'搜索对策名称或正文';
   favOnlyBtn('#strategy-fav-only',state.strategyFav);
   renderPlan();
   const groups=['全部',...new Set(items.map(x=>x.group))];
   $('#strategy-chips').innerHTML=groups.map(x=>`<button class="chip${state.strategyFilter===x?' active':''}" data-schip="${esc(x)}">${esc(x)}</button>`).join('');
   const q=state.strategyQuery.trim().toLowerCase();
   let arr=items.filter(x=>(state.strategyFilter==='全部'||x.group===state.strategyFilter)&&(!state.strategyFav||isFav(type,x.id))&&(!q||(x.title+x.text+(x.signals?x.signals.join(''):'')).toLowerCase().includes(q)));
   if($('#strategy-sort').value==='title')arr=arr.slice().sort((a,b)=>a.title.localeCompare(b.title,'zh'));
   state.strategyOrder=arr.map(x=>x.id);
   $('#strategy-count').textContent=arr.length===items.length?'共 '+arr.length+' 条':arr.length+' / '+items.length+' 条';
   const sel=isP?state.selectedProblem:state.selectedStrategy;
   $('#strategy-list').innerHTML=arr.length?arr.map(x=>`<article class="data-card${sel===x.id?' selected':''}" data-lib="${x.id}" tabindex="0" role="button"><div class="card-main"><div class="card-title">${hi(x.title,q)}</div><p>${hi(x.text,q)}</p><div class="card-meta"><span>${esc(x.group)}</span>${isP?`<span>对应 ${x.strategies.length} 条对策</span>`:state.plan.includes(x.id)?'<span class="st-ok">已在组合</span>':''}</div></div>${starBtn(type,x.id)}</article>`).join('')
     :`<div class="empty">${state.strategyFav&&!q?'这里还没有收藏。':'没有找到。换个更短的词试试。'}</div>`;
 }
 function strategyTemplate(text){return esc(text).replace(/(\.\.\.|……)/g,'<span class="highlight">…</span>')}
 function renderStrategyDetail(id){
   const x=strategyById(id);if(!x)return;const fav=isFav('strategy',id),inPlan=state.plan.includes(id);
   const rel=PROBLEMS.filter(p=>p.strategies.includes(id)).slice(0,6);
   const hasSlot=/\.\.\.|……/.test(x.text);
   $('#strategy-detail').innerHTML=sheetCloseBtn()+`<div class="detail-kicker">对策 · ${esc(x.group)}</div><h2>${esc(x.title)}</h2><div class="detail-label">模板</div><div class="quote-text" id="strategy-quote">${strategyTemplate(x.text)}</div>`
     +(hasSlot?`<div class="replace-row"><input id="replace-input" class="replace-input" placeholder="把“…”换成，如：乡村旅游" enterkeyhint="done" autocomplete="off"/><button class="mini-btn" data-do="fill">替换</button></div>`:'')
     +`<div class="detail-actions"><button class="is-primary" data-do="copy">${ico('copy')}复制</button><button class="${inPlan?'is-on':''}" data-do="plan">${ico(inPlan?'check':'plus')}${inPlan?'已在组合':'加入组合'}</button><button class="${fav?'is-on':''}" data-do="fav">${ico('star')}${fav?'已收藏':'收藏'}</button></div>`
     +(rel.length?`<div class="detail-sub"><h3>这条对策能解决的问题</h3><div class="link-list">${rel.map(p=>`<button data-jump-problem="${p.id}"><b>${esc(p.title)}</b><span>${esc(p.group)}</span></button>`).join('')}</div></div>`:'')
     +navRow(state.strategyMode==='strategy'?state.strategyOrder:[],id);
 }
 function renderProblemDetail(id){
   const p=problemById(id);if(!p)return;const fav=isFav('problem',id);
   const rel=p.strategies.map(strategyById).filter(Boolean);
   $('#strategy-detail').innerHTML=sheetCloseBtn()+`<div class="detail-kicker">问题 · ${esc(p.group)}</div><h2>${esc(p.title)}</h2><div class="detail-label">规范表述</div><div class="quote-text">${esc(p.text)}</div>`
     +`<div class="detail-sub"><h3>材料里常见的说法</h3><div class="signal-list">${p.signals.map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`
     +`<div class="detail-actions"><button class="is-primary" data-do="copy">${ico('copy')}复制</button><button class="${fav?'is-on':''}" data-do="fav">${ico('star')}${fav?'已收藏':'收藏'}</button></div>`
     +(rel.length?`<div class="detail-sub"><h3>可以用的对策</h3><div class="link-list">${rel.map(s=>`<button data-jump-strategy="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.group)}</span></button>`).join('')}</div></div>`:'')
     +`<div class="src-note">整理自开源题库 zzcc-nb/gongkao-tiku 的「问题类规范词」${p.origin?'（原词条：'+esc(p.origin)+'）':''}。</div>`
     +navRow(state.strategyMode==='problem'?state.strategyOrder:[],id);
 }
 const markLibCard=id=>$$('#strategy-list .data-card').forEach(c=>c.classList.toggle('selected',+c.dataset.lib===id));
 function selectStrategy(id){
   const x=strategyById(id);if(!x)return;
   if(state.strategyMode!=='strategy'){state.strategyMode='strategy';state.strategyFilter='全部';renderStrategy()}
   state.selectedStrategy=id;addRecent('strategy',id,x.title,x.group);
   markLibCard(id);renderStrategyDetail(id);openSheet($('#strategy-detail'));
 }
 function selectProblem(id){
   const p=problemById(id);if(!p)return;
   if(state.strategyMode!=='problem'){state.strategyMode='problem';state.strategyFilter='全部';renderStrategy()}
   state.selectedProblem=id;addRecent('problem',id,p.title,p.group);
   markLibCard(id);renderProblemDetail(id);openSheet($('#strategy-detail'));
 }
 function resetLibFilter(){state.strategyFilter='全部';state.strategyQuery='';state.strategyFav=false;$('#strategy-search').value=''}
 function jumpStrategy(id){state.strategyMode='strategy';resetLibFilter();renderStrategy();selectStrategy(id)}
 function jumpProblem(id){state.strategyMode='problem';resetLibFilter();renderStrategy();selectProblem(id)}
 function libEmptyDetail(){$('#strategy-detail').innerHTML='<div class="detail-empty">'+(state.strategyMode==='problem'?'点左边任意一条，查看规范表述和可用的对策。':'点左边任意一条查看模板。')+'</div>'}
 bindList('#strategy-list','data-lib',id=>state.strategyMode==='problem'?selectProblem(id):selectStrategy(id));
 bindDetail('#strategy-detail',{
   nav:id=>state.strategyMode==='problem'?selectProblem(id):selectStrategy(id),
   copy:()=>{
     if(state.strategyMode==='problem'){copy(problemById(state.selectedProblem).text);return}
     const qEl=$('#strategy-quote');copy(qEl?qEl.textContent:strategyById(state.selectedStrategy).text);
   },
   fav:()=>state.strategyMode==='problem'?toggleFav('problem',state.selectedProblem):toggleFav('strategy',state.selectedStrategy),
   plan:()=>togglePlan(state.selectedStrategy),
   fill:()=>{
     const x=strategyById(state.selectedStrategy),inp=$('#replace-input'),val=inp?inp.value.trim():'';
     if(!val){if(inp)inp.focus();toast('先填要替换成的对象');return}
     $('#strategy-quote').innerHTML=esc(x.text).replace(/\.\.\.|……/g,'<span class="highlight">'+esc(val)+'</span>');
     if(inp)inp.blur();toast('已替换，点「复制」带走');
   }
 });
 $('#strategy-detail').addEventListener('click',e=>{
   const a=e.target.closest('[data-jump-problem]'),b=e.target.closest('[data-jump-strategy]');
   if(a)jumpProblem(+a.dataset.jumpProblem);else if(b)jumpStrategy(+b.dataset.jumpStrategy);
 });
 $('#strategy-detail').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='replace-input'){e.preventDefault();const b=$('#strategy-detail [data-do="fill"]');if(b)b.click()}});
 $('#strategy-chips').addEventListener('click',e=>{const b=e.target.closest('[data-schip]');if(!b)return;state.strategyFilter=b.dataset.schip;renderStrategy()});
 $('#strategy-search').addEventListener('input',e=>{state.strategyQuery=e.target.value;renderStrategy()});
 $('#strategy-sort').addEventListener('change',renderStrategy);
 $('#strategy-fav-only').addEventListener('click',()=>{state.strategyFav=!state.strategyFav;renderStrategy()});
 $('#strategy-random').addEventListener('click',()=>{const o=state.strategyOrder;if(!o.length)return;const id=o[Math.floor(Math.random()*o.length)];if(state.strategyMode==='problem')selectProblem(id);else selectStrategy(id)});
 $$('[data-smode]').forEach(b=>b.addEventListener('click',()=>{if(state.strategyMode===b.dataset.smode)return;state.strategyMode=b.dataset.smode;resetLibFilter();renderStrategy();libEmptyDetail()}));

 /* ---------- 6. 案例 ---------- */
 const CHAPTERS=[...new Set(DATA.cases.map(x=>x.chapter))];
 function renderCases(){
   $('#case-topics').innerHTML=`<button class="chip${state.caseChapter==='all'?' active':''}" data-chapter="all">全部</button>`+CHAPTERS.map(x=>`<button class="chip${state.caseChapter===x?' active':''}" data-chapter="${esc(x)}">${esc(chapterName(x))}</button>`).join('');
   favOnlyBtn('#case-fav-only',state.caseFav);
   const sections=[...new Set(DATA.cases.filter(x=>state.caseChapter==='all'||x.chapter===state.caseChapter).map(x=>x.section))];
   $('#case-section').innerHTML='<option value="all">全部小节</option>'+sections.map(x=>`<option value="${esc(x)}"${state.caseSection===x?' selected':''}>${esc(sectionName(x))}</option>`).join('');
   const q=state.caseQuery.trim().toLowerCase();
   const arr=DATA.cases.map((x,i)=>Object.assign({},x,{id:i})).filter(x=>(state.caseChapter==='all'||x.chapter===state.caseChapter)&&(state.caseSection==='all'||x.section===state.caseSection)&&(!state.caseFav||isFav('case',x.id))&&(!q||(x.title+x.keywords+x.case+x.topics).toLowerCase().includes(q)));
   state.caseOrder=arr.map(x=>x.id);
   $('#case-count').textContent=arr.length===DATA.cases.length?'共 '+arr.length+' 条':arr.length+' / '+DATA.cases.length+' 条';
   $('#case-list').innerHTML=arr.length?arr.slice(0,state.caseLimit).map(x=>`<article class="data-card" data-case="${x.id}" tabindex="0" role="button"><div class="card-main"><div class="card-title">${hi(x.title,q)}</div><div class="case-desc">${hi(x.case,q)}</div><div class="card-meta"><span>${esc(sectionName(x.section))}</span>${x.keywords.split('丨').slice(0,2).map(k=>`<span>${hi(k,q)}</span>`).join('')}</div></div>${starBtn('case',x.id)}</article>`).join('')+(arr.length>state.caseLimit?`<button class="load-more" data-more>再显示 ${Math.min(40,arr.length-state.caseLimit)} 条（还有 ${arr.length-state.caseLimit} 条）</button>`:'')
     :`<div class="empty">${state.caseFav&&!q?'还没有收藏的案例。':'没有找到。换个更短的词试试。'}</div>`;
 }
 function renderCaseDetail(id){
   const x=DATA.cases[id];if(!x)return;const fav=isFav('case',id);
   $('#drawer-content').innerHTML=`<div class="detail-kicker">${esc(chapterName(x.chapter))} · ${esc(sectionName(x.section))}</div><h2>${esc(x.title)}</h2><div class="keyword-list">${x.keywords.split('丨').map(k=>`<span class="keyword">${esc(k)}</span>`).join('')}</div>`
     +`<div class="drawer-section"><h3>案例</h3><p>${esc(x.case)}</p></div>`
     +`<div class="drawer-section"><h3>适用话题</h3><p class="plain">${esc(x.topics).replace(/丨/g,' · ')}</p></div>`
     +`<div class="detail-actions"><button class="is-primary" data-do="copy">${ico('copy')}复制案例</button><button class="${fav?'is-on':''}" data-do="fav">${ico('star')}${fav?'已收藏':'收藏'}</button></div>`
     +navRow(state.caseOrder,id);
 }
 function openCase(id){
   const x=DATA.cases[id];if(!x)return;
   state.selectedCase=id;addRecent('case',x.title,x.title,chapterName(x.chapter)+' · '+sectionName(x.section));
   renderCaseDetail(id);
   const d=$('#case-drawer');d.querySelector('.drawer').scrollTop=0;d.classList.add('open');
   if(mqSheet.matches)root.classList.add('sheet-open');
 }
 bindList('#case-list','data-case',openCase);
 $('#case-list').addEventListener('click',e=>{if(e.target.closest('[data-more]')){state.caseLimit+=40;renderCases()}});
 bindDetail('#drawer-content',{nav:openCase,copy:()=>copy(DATA.cases[state.selectedCase].case),fav:()=>toggleFav('case',state.selectedCase)});
 $('#case-topics').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(!b)return;state.caseChapter=b.dataset.chapter;state.caseSection='all';state.caseLimit=40;renderCases()});
 $('#case-section').addEventListener('change',e=>{state.caseSection=e.target.value;state.caseLimit=40;renderCases()});
 $('#case-search').addEventListener('input',e=>{state.caseQuery=e.target.value;state.caseLimit=40;renderCases()});
 $('#case-fav-only').addEventListener('click',()=>{state.caseFav=!state.caseFav;renderCases()});
 $('#case-random').addEventListener('click',()=>{const o=state.caseOrder.length?state.caseOrder:DATA.cases.map((x,i)=>i);openCase(o[Math.floor(Math.random()*o.length)])});

 /* ---------- 7. 公文 ---------- */
 function formatDemoText(f){const d=f.demo||{};let arr=d.metaFirst?(d.meta||[]).concat([d.title]):[d.title].concat(d.meta||[]);if(d.to)arr.push(d.to);arr=arr.concat(d.body||[]);if(d.end)arr.push(d.end);if(d.sign)arr.push(d.sign);if(d.date)arr.push(d.date);if(d.foot)arr.push(d.foot);return arr.filter(Boolean).join('\n')}
 function formatPaper(d){const meta=(d.meta||[]).map(x=>`<div>${esc(x)}</div>`).join('');const mh=meta?`<div class="fp-meta">${meta}</div>`:'';return (d.metaFirst?mh:'')+`<div class="fp-title">${esc(d.title)}</div>`+(d.metaFirst?'':mh)+(d.to?`<div class="fp-to">${esc(d.to)}</div>`:'')+(d.body||[]).map(x=>`<p class="fp-p">${esc(x)}</p>`).join('')+(d.end?`<p class="fp-p fp-end">${esc(d.end)}</p>`:'')+((d.sign||d.date)?`<div class="fp-sign">${d.sign?`<span>${esc(d.sign)}</span>`:''}${d.date?`<span>${esc(d.date)}</span>`:''}</div>`:'')+(d.foot?`<div class="fp-foot">${esc(d.foot)}</div>`:'')}
 function renderFormat(){
   if(!FORMATS.length){$('#format-nav').innerHTML='';$('#format-body').innerHTML='<div class="empty">公文数据没有加载出来，刷新页面试试。</div>';return}
   if(state.formatIndex>=FORMATS.length)state.formatIndex=0;
   const f=FORMATS[state.formatIndex],cats=[...new Set(FORMATS.map(x=>x.cat))],navEl=$('#format-nav'),first=!navEl.children.length;
   if(first)navEl.innerHTML=cats.map(cat=>`<div class="format-nav-group"><div class="format-nav-title">${esc(cat)}</div>`+FORMATS.map((x,i)=>({x,i})).filter(o=>o.x.cat===cat).map(o=>`<button data-format="${o.i}"><b>${esc(o.x.name)}</b><small>${esc(o.x.tag)}</small></button>`).join('')+`</div>`).join('');
   $$('#format-nav [data-format]').forEach(b=>{const on=+b.dataset.format===state.formatIndex;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
   const checks=(f.checks&&f.checks.length)?f.checks:['标题和文种对得上，题干要求的主题出现了','称呼、主送机关、落款齐全，对象没写错','每条措施都有具体动作，没有空话','有结尾的要求或号召，字数在范围内'];
   $('#format-body').innerHTML=`<div class="format-title"><div><h2>${esc(f.name)}</h2><p>${esc(f.cat)} · ${esc(f.tag)}</p></div><button class="mini-btn" id="format-copy">${ico('copy')}复制例文</button></div>`
     +`<div class="format-cols"><div class="format-left"><div class="sec-title">结构</div><div class="format-steps">${f.structure.map((x,i)=>`<div class="format-step"><span class="step-no">${i+1}</span><span>${esc(x)}</span></div>`).join('')}</div><div class="format-tip"><b>注意　</b>${esc(f.tip)}</div></div>`
     +`<div class="format-right"><div class="paper-head"><b>例文</b></div><div class="format-paper">${formatPaper(f.demo)}</div>${f.layout?`<div class="paper-note">版式：${esc(f.layout)}</div>`:''}</div></div>`
     +`<div class="checklist"><h3>写完检查</h3><div class="checklist-rows">${checks.map(x=>`<div class="check-row">${ico('check')}<span>${esc(x)}</span></div>`).join('')}</div></div>`;
   $('#format-copy').onclick=()=>copy(formatDemoText(f),'例文已复制');
 }
 $('#format-nav').addEventListener('click',e=>{
   const b=e.target.closest('[data-format]');if(!b)return;
   state.formatIndex=+b.dataset.format;renderFormat();
   /* 手机上文种是横向滑动的一排，选中后让它留在视野里；正文回到开头 */
   if(mqSheet.matches){if(b.scrollIntoView)b.scrollIntoView({block:'nearest',inline:'center'});const top=$('#format-body').getBoundingClientRect().top+window.scrollY-(parseFloat(getComputedStyle(root).getPropertyValue('--topbar-h'))||52)-150;if(window.scrollY>top)window.scrollTo(0,Math.max(0,top))}
 });
 $('#format-print').onclick=()=>window.print();

 /* ---------- 8. 复习 ---------- */
 const practice={vocab:[],case:[]};
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 function makePractice(){
   const all=DATA.vocab.map((x,i)=>Object.assign({},x,{id:i}));
   /* 先出标了「还不熟」的，再出没学过的，最后才是已掌握的 */
   const weak=all.filter(x=>state.mastery[x.id]===1),fresh=all.filter(x=>state.mastery[x.id]==null),known=all.filter(x=>state.mastery[x.id]===2);
   practice.vocab=[...shuffle(weak),...shuffle(fresh),...shuffle(known)].slice(0,10);
   practice.case=shuffle(DATA.cases).slice(0,10);
   state.practiceIndex=0;state.practiceAnswered=false;
 }
 function renderPractice(){
   if(!practice.vocab.length)makePractice();
   const mode=state.practiceMode,x=practice[mode][state.practiceIndex];
   $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
   $('#practice-progress').textContent='第 '+(state.practiceIndex+1)+' / 10 题';
   $('#practice-meter').style.width=state.practiceIndex*10+'%';
   $('#practice-type').textContent=mode==='vocab'?'用一句规范的话概括这段材料':'这个案例可以用来论证什么？';
   $('#practice-prompt').textContent=mode==='vocab'?x.scene:x.case;
   $('#practice-answer').innerHTML=mode==='vocab'?`规范说法：<b>${esc(x.term)}</b>`:`关键词：<b>${esc(x.keywords.replace(/丨/g,'、'))}</b><br/>适用话题：${esc(x.topics.replace(/丨/g,'、'))}`;
   $('#practice-answer').classList.add('hidden');$('#practice-self-actions').classList.add('hidden');$('#practice-actions').classList.remove('hidden');
   $('#practice-input').value='';state.practiceAnswered=false;
   $('#practice-hint').textContent=mode==='vocab'?'':'案例题只做对照，不记入掌握程度';
 }
 function nextPractice(){
   state.practiceIndex++;
   if(state.practiceIndex>=10){makePractice();toast('这组练完了，已换新的一组')}
   renderPractice();if(state.view==='review')renderReviewNums();
 }
 function ratePractice(level){
   if(state.practiceMode==='vocab'){const x=practice.vocab[state.practiceIndex];state.mastery[x.id]=level;save()}
   nextPractice();
 }
 function startTraining(){
   const t=$('#review-train');t.hidden=false;makePractice();renderPractice();
   $('#review-start').textContent='再来一组';
   requestAnimationFrame(()=>{if(t.scrollIntoView)t.scrollIntoView({behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth',block:'start'})});
 }
 $('#practice-reveal').addEventListener('click',()=>{$('#practice-answer').classList.remove('hidden');$('#practice-self-actions').classList.remove('hidden');$('#practice-actions').classList.add('hidden');state.practiceAnswered=true});
 $('#practice-easy').addEventListener('click',()=>ratePractice(2));
 $('#practice-again').addEventListener('click',()=>ratePractice(1));
 $('#practice-next').addEventListener('click',nextPractice);
 $('#practice-reset').addEventListener('click',()=>{makePractice();renderPractice()});
 $('#practice-close').addEventListener('click',()=>{$('#review-train').hidden=true;$('#review-start').textContent='练 10 题';renderReview()});
 $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(state.practiceMode===b.dataset.mode)return;state.practiceMode=b.dataset.mode;makePractice();renderPractice()}));
 $('#review-start').addEventListener('click',startTraining);
 function renderReviewNums(){
   const lv=Object.keys(state.mastery).map(k=>state.mastery[k]),mastered=lv.filter(x=>x===2).length,weak=lv.filter(x=>x===1).length;
   $('#review-due').textContent=weak;$('#review-mastered').textContent=mastered;$('#review-fav-num').textContent=Object.keys(state.favorites).length;
   $('#review-bar-fill').style.width=(DATA.vocab.length?mastered/DATA.vocab.length*100:0)+'%';
 }
 function renderReview(){
   renderReviewNums();
   const all=DATA.vocab.map((x,i)=>Object.assign({},x,{id:i}));
   const tab=state.reviewTab,isNotes=tab==='notes';
   $$('[data-review-tab]').forEach(b=>{const on=b.dataset.reviewTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on)});
   let items=[];
   if(tab==='due')items=all.filter(x=>state.mastery[x.id]===1).map(x=>({type:'vocab',id:x.id,title:x.term,sub:x.scene,tag:'规范词'}));
   if(tab==='mastered')items=all.filter(x=>state.mastery[x.id]===2).map(x=>({type:'vocab',id:x.id,title:x.term,sub:x.scene,tag:'规范词'}));
   if(tab==='favorites')items=Object.values(state.favorites).map(f=>{
     if(f.type==='vocab'){const x=DATA.vocab[f.id];return x&&{type:f.type,id:f.id,title:x.term,sub:x.scene,tag:'规范词'}}
     if(f.type==='problem'){const x=problemById(f.id);return x&&{type:f.type,id:f.id,title:x.title,sub:x.text,tag:'问题'}}
     if(f.type==='strategy'){const x=strategyById(f.id);return x&&{type:f.type,id:f.id,title:x.title,sub:x.text,tag:'对策'}}
     const x=DATA.cases[f.id];return x&&{type:'case',id:f.id,title:x.title,sub:x.case,tag:'案例'};
   }).filter(Boolean).reverse();
   $('#review-count').textContent=isNotes?'':items.length+' 条'+(items.length>120?'，显示前 120 条':'');
   $('#review-list').style.display=isNotes?'none':'';
   $('#note-pane').hidden=!isNotes;
   $('#fav-tools').hidden=!(tab==='favorites'&&items.length);
   if(isNotes){const t=$('#note-text');if(t&&document.activeElement!==t)t.value=LS.getItem('sh_note')||''}
   const emptyText={due:'没有标记为「还不熟」的词。<br/>练一组，把拿不准的标出来，它们会排在这里。',mastered:'还没有标为「已掌握」的词。',favorites:'还没有收藏。<br/>在规范词、对策或案例里点星标，就会出现在这里。'}[tab]||'';
   $('#review-list').innerHTML=items.length?items.slice(0,120).map(x=>`<article class="review-item" data-review-open="${x.type}:${x.id}" tabindex="0" role="button"><b>${esc(x.title)}</b><p>${esc(x.sub)}</p>${tab==='favorites'?`<small>${x.tag}</small>`:''}</article>`).join(''):`<div class="review-empty">${emptyText}</div>`;
 }
 $('#review-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-review-tab]');if(!b)return;state.reviewTab=b.dataset.reviewTab;renderReview()});
 function openReviewItem(el){
   const p=el.dataset.reviewOpen.split(':'),t=p[0],id=+p[1];
   if(t==='vocab'){openView('vocab');selectVocab(id)}
   else if(t==='strategy'){state.strategyMode='strategy';openView('strategy');selectStrategy(id)}
   else if(t==='problem'){state.strategyMode='problem';openView('strategy');selectProblem(id)}
   else{openView('cases');openCase(id)}
 }
 $('#review-list').addEventListener('click',e=>{const el=e.target.closest('[data-review-open]');if(el)openReviewItem(el)});
 $('#review-list').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.reviewOpen)openReviewItem(e.target)});
 /* 笔记：停笔自动保存，也可以手动点保存 */
 let noteT=null;
 const saveNote=()=>{LS.setItem('sh_note',$('#note-text').value);$('#note-status').textContent='已保存 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})};
 $('#note-text').addEventListener('input',()=>{$('#note-status').textContent='正在输入…';clearTimeout(noteT);noteT=setTimeout(saveNote,800)});
 $('#save-note').addEventListener('click',()=>{clearTimeout(noteT);saveNote();toast('笔记已保存')});
 $('#clear-favs').addEventListener('click',()=>appConfirm('清空全部收藏？清空后无法恢复。',()=>{state.favorites={};save();renderReview();toast('收藏已清空')},'清空'));

 /* ---------- 9. 设置 ---------- */
 function applyTheme(){
   const pref=LS.getItem('sh_theme')||'auto';
   const sysDark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;
   const dark=pref==='dark'||(pref==='auto'&&sysDark);
   root.setAttribute('data-theme',dark?'dark':'light');
   const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',dark?'#161513':'#f4f2ed');
   const tb=$('#theme-btn');if(tb){tb.innerHTML=ico(dark?'moon':'sun');tb.title=dark?'切换到浅色':'切换到深色';tb.setAttribute('aria-label',tb.title)}
   $$('#theme-choice button').forEach(b=>{const on=b.dataset.themeChoice===pref;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 }
 function applyPrefs(){
   const font=LS.getItem('sh_font')||'normal',read=LS.getItem('sh_read')||root.getAttribute('data-read')||'serif';
   /* 没手动设置过时，跟随系统的「减弱动态效果」 */
   const rm=LS.getItem('sh_reduce_motion'),reduce=rm==null?!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches):rm==='1';
   root.setAttribute('data-font',font);root.setAttribute('data-read',read);
   document.body.classList.toggle('reduce-motion',reduce);
   $$('[data-font]').forEach(b=>{const on=b.dataset.font===font;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
   $$('#read-font-choice [data-read]').forEach(b=>{const on=b.dataset.read===read;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
   const t=$('#reduce-motion');t.classList.toggle('on',reduce);t.setAttribute('aria-checked',reduce);
 }
 function renderSettings(){
   applyPrefs();
   const am=window.SH_ANSWER_META,idx=window.SH_EXAM_INDEX||[];
   $('#about-lib').textContent='规范词 '+DATA.vocab.length+' · 对策 '+DATA.strategies.length+' · 问题 '+PROBLEMS.length+' · 案例 '+DATA.cases.length;
   if(idx.length){const provs=new Set(idx.map(x=>x.r));provs.delete('国考');$('#about-exams').textContent=idx.length+' 套 · 国考和 '+provs.size+' 个省区市'}
   if(am&&am.total)$('#about-ref').textContent='覆盖 '+am.covered+' / '+am.total+' 题';
 }
 $$('#theme-choice button').forEach(b=>b.addEventListener('click',()=>{LS.setItem('sh_theme',b.dataset.themeChoice);applyTheme()}));
 if(window.matchMedia){const mq=matchMedia('(prefers-color-scheme: dark)');const th=()=>{if((LS.getItem('sh_theme')||'auto')==='auto')applyTheme()};mq.addEventListener?mq.addEventListener('change',th):mq.addListener&&mq.addListener(th)}
 $$('#font-size-choice [data-font]').forEach(b=>b.addEventListener('click',()=>{LS.setItem('sh_font',b.dataset.font);applyPrefs();if(window.SH_WSRELAYOUT)window.SH_WSRELAYOUT()}));
 $$('#read-font-choice [data-read]').forEach(b=>b.addEventListener('click',()=>{LS.setItem('sh_read',b.dataset.read);applyPrefs();if(window.SH_WSRELAYOUT)window.SH_WSRELAYOUT()}));
 $('#reduce-motion').addEventListener('click',()=>{const on=document.body.classList.contains('reduce-motion');LS.setItem('sh_reduce_motion',on?'0':'1');applyPrefs()});
 function exportData(){
   const ws={};for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&k.indexOf('sh_ws_')===0)ws[k]=LS.getItem(k)}
   const payload={app:'申论词库',version:5,exportedAt:new Date().toISOString(),favorites:state.favorites,mastery:state.mastery,plan:state.plan,recent:state.recent,note:LS.getItem('sh_note')||'',font:LS.getItem('sh_font')||'normal',read:LS.getItem('sh_read')||'',lab:LS.getItem('sh_lab_v1')||'',ws};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='申论词库备份-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   toast('备份文件已导出');
 }
 $('#export-data').addEventListener('click',exportData);
 $('#import-data').addEventListener('change',e=>{
   const file=e.target.files&&e.target.files[0];if(!file)return;
   const reader=new FileReader();
   reader.onload=()=>{
     try{
       const d=JSON.parse(reader.result);
       if(!d||typeof d!=='object'||!(d.favorites||d.mastery||d.ws||d.note!=null||d.lab))throw new Error('bad');
       if(d.favorites)state.favorites=d.favorites;if(d.mastery)state.mastery=d.mastery;if(Array.isArray(d.plan))state.plan=d.plan;if(Array.isArray(d.recent))state.recent=d.recent;
       if(typeof d.note==='string')LS.setItem('sh_note',d.note);if(d.font)LS.setItem('sh_font',d.font);if(d.read)LS.setItem('sh_read',d.read);
       if(d.ws&&typeof d.ws==='object')Object.keys(d.ws).forEach(k=>{if(k.indexOf('sh_ws_')===0)LS.setItem(k,d.ws[k])});
       if(typeof d.lab==='string'&&d.lab)LS.setItem('sh_lab_v1',d.lab);
       save();toast('备份已恢复，正在刷新…');setTimeout(()=>location.reload(),700);
     }catch(err){toast('这个文件不是申论词库的备份')}
   };
   reader.readAsText(file);e.target.value='';
 });
 $('#reset-data').addEventListener('click',()=>appConfirm('清空这台设备上的全部学习记录？作答、标注、批改、收藏和笔记都会删除，无法恢复。建议先导出备份。',()=>{
   const keys=[];for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&k.indexOf('sh_')===0&&k!=='sh_theme')keys.push(k)}
   keys.forEach(k=>LS.removeItem(k));location.reload();
 },'清空'));

 /* ---------- 10. 搜索 ---------- */
 function globalSearch(q){
   const box=$('#global-results');q=(q||'').trim().toLowerCase();
   if(!q){
     /* 没输入时给出最近看过的，少打几个字 */
     box.innerHTML=state.recent.length?'<div class="gs-empty">最近看过</div>'+state.recent.slice(0,6).map((x,i)=>`<button class="global-result" data-gs-recent="${i}"><span class="result-type">${TYPE_LABEL[x.type]||'案例'}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub||'')}</small></span></button>`).join(''):'<div class="gs-empty">可以搜规范词、对策、问题、案例和练习题。</div>';
     box.classList.add('open');return;
   }
   const has=s=>s.toLowerCase().includes(q);
   const vs=DATA.vocab.map((x,i)=>({type:'vocab',id:i,title:x.term,sub:x.scene})).filter(x=>has(x.title+x.sub)).slice(0,4);
   const ss=DATA.strategies.filter(x=>has(x.title+x.text)).slice(0,3).map(x=>({type:'strategy',id:x.id,title:x.title,sub:x.text}));
   const ps=PROBLEMS.filter(x=>has(x.title+x.text+(x.signals||[]).join(''))).slice(0,2).map(x=>({type:'problem',id:x.id,title:x.title,sub:x.text}));
   const cs=DATA.cases.map((x,i)=>({type:'case',id:i,title:x.title,sub:x.case,all:x.title+x.keywords+x.case+x.topics})).filter(x=>has(x.all)).slice(0,4);
   const items=[...vs,...ss,...ps,...cs,...(window.SH_LABHOOK&&SH_LABHOOK.search?SH_LABHOOK.search(q):[])];
   box.innerHTML=items.length?items.map(x=>`<button class="global-result" data-global="${x.type}:${esc(x.m||'')}:${esc(x.id)}"><span class="result-type">${x.type==='lab'?esc(x.kind||'练习'):TYPE_LABEL[x.type]}</span><span><b>${hi(x.title,q)}</b><small>${esc(x.sub)}</small></span></button>`).join(''):'<div class="gs-empty">没有找到。换个更短的词试试。</div>';
   box.classList.add('open');
 }
 $('#global-results').addEventListener('click',e=>{
   const r=e.target.closest('[data-gs-recent]');
   if(r){const x=state.recent[+r.dataset.gsRecent];closeSearch();if(x)openRecent(x.type,x.id);return}
   const b=e.target.closest('[data-global]');if(!b)return;
   const p=b.dataset.global.split(':'),t=p[0],m=p[1],id=p.slice(2).join(':');
   $('#global-search').value='';closeSearch();
   if(t==='vocab'){openView('vocab');selectVocab(+id)}
   else if(t==='strategy'){state.strategyMode='strategy';openView('strategy');selectStrategy(+id)}
   else if(t==='problem'){state.strategyMode='problem';openView('strategy');selectProblem(+id)}
   else if(t==='lab'){openView('lab');if(window.SH_LABHOOK)SH_LABHOOK.openItem(m,id)}
   else{openView('cases');openCase(+id)}
 });
 $('#search-btn').addEventListener('click',openSearch);
 $('#search-cancel').addEventListener('click',()=>{$('#global-search').value='';closeSearch()});
 $('#global-search').addEventListener('focus',e=>globalSearch(e.target.value));
 $('#global-search').addEventListener('input',e=>globalSearch(e.target.value));
 document.addEventListener('click',e=>{if(!e.target.closest('.search')&&!e.target.closest('#search-btn')&&!searchWrap.classList.contains('open'))$('#global-results').classList.remove('open')});

/* ================= 真题作答台 ================= */
/* ================= 批改引擎（五项评分） =================
 * 评分知识来源（GitHub 开源项目）：
 *  · SLB (Jinghe1279/SLB) GRADING_STANDARD.md —— 分题型评分细则、按点给分/采意不采点、万能对策识别、大作文分档
 *  · kaogong-skill (KeWang0622/kaogong-skill) —— 题型判定、答题结构标准（对策=主体+手段+内容+目的）
 *  · kaogong-formalizer (heihei999/kaogong-formalizer) —— 口语→规范词映射（7 家机构交叉验证）
 * 全部为本地规则引擎，无网络请求，结果仅供参考。
 */
const GRADE=(function(){
  const ORAL=[["干部与群众拉家常、去到群众家里",["密切联系群众","深入基层"]],["某事牵涉多家单位/部门",["多头管理","政出多门"]],["某件事谁来主管、谁来执行等不明确",["管理权责不明"]],["教育过分重视升学率、实用性",["教育功利化"]],["媒体报道后，立马查找、解决问题",["发挥媒体的监督功能"]],["希望满足市场需求",["以市场为导向"]],["通过投入大量资金对某地进行扶贫",["加大扶贫资金投入","\"输血式\"扶贫"]],["治理河道、兴建水利、改造公路等",["基础设施建设"]],["城乡一体化发展/兼顾城乡",["城乡协调发展"]],["加大政策财政扶持力度/政策倾斜",["政策扶持"]],["缺少规范管理，民主公开操作性不足",["公开不足"]],["通过群众监督干部行为",["民主监督"]],["国家政策，基层不落实也没有人管",["缺乏监管","落实难"]],["官员、相关负责人的责任予以追究",["问责制"]],["提高风险意识/建立预警机制",["风险意识","忧患意识"]],["成立专项领导小组、共治小组",["成立专项领导小组"]],["精简办事流程，提高工作效率",["流程优化"]],["挨家挨户走一遍",["入户走访"]],["群众满意度测评",["群众监督"]],["村党组织/党支部建设落后",["党建落后"]],["成立专门机构、完善组织机构",["完善机构"]],["利用互联网大数据进行管理",["数字化管理"]],["定期展示工作动态",["提高透明度"]],["多主体共同解决一件事",["多元共治"]],["轻易承诺，因各种问题无法兑现",["空头支票"]],["管理方面拖了\"后腿\"",["管理滞后","迟缓","缓慢"]],["执法过程中文明用语，依法依规办事",["人性化执法","文明执法"]],["划定保护区域网格，立起保护标志",["网格化管理"]],["由领导牵头，一起做好某事",["成立专项领导小组","共治小组"]],["用打、砸、抢、骂形式治理商贩",["长效管理（反面：暴力执法）"]],["做什么事觉得艰难而后放弃",["遇到困难容易放弃","抗挫折能力弱"]],["做某件事为了收礼",["以敛财为目的"]],["……和……不应该厚此薄彼/并重",["兼顾……和……","统筹兼顾","全局意识"]],["遇到困难仍然坚守岗位",["爱岗敬业","恪尽职守"]],["迫切希望达到目的",["功利","急功近利"]],["会玩些\"小花样\"，动脑筋，点子多",["创新能力强","有创意"]],["对……不认同，不觉得某事是好的",["认同感低","认同感不高"]],["以前是某种主流观念，现在不再持有",["转变观念","转变思想"]],["夜以继日、合力奋战，攻克难关",["刻苦钻研"]],["喜欢招大商、大项目、形象工程",["脱离实际","贪大求洋","好大喜功"]],["签订合同之后又不履行",["合同意识差","不讲信用","缺乏契约精神"]],["某个东西大家都不知道、没听过",["知名度不高"]],["根本不把交通规则当回事",["缺乏安全意识"]],["看到大家努力，自己也努力做",["公众觉悟","责任意识"]],["送礼不接受/做事不是为了收礼",["不图回报","无私奉献"]],["让他们放手去干/让想法落到实处",["调动","发挥人的主观能动性"]],["为了工作创下三个月没回家的记录",["舍小家为大家"]],["你越让我干什么，我越不干什么",["逆反心理"]],["把私人东西夸大宣传",["夸大宣传"]],["有……鼓励机制",["建立……机制"]],["将别人的经验改进成适合自己的方法",["根据实际情况改进"]],["告别传统粗放式的土地管理方式",["土地精细化管理"]],["\"睁一只眼闭一只眼\"",["执法不严"]],["多个部门共同解决一件事",["协调","联动","合力"]],["成立专项小组",["成立专项领导小组"]],["责任不清、多头管理",["责任主体不明","权责不明"]],["信息不沟通、各自行事",["信息闭塞","信息壁垒","缺乏沟通机制"]],["加强相关组织联系、互通信息",["信息共享","打破信息壁垒","加强沟通"]],["政策坚持推行，不搞\"一阵风\"",["常态化","系统化","常态机制"]],["一项政策顾及以后",["前瞻性","预见性"]],["政府充分听取专家群众意见",["科学决策","民主决策"]],["党员、党组织、党委带领群众发展",["党建引领"]],["群众指出问题之后能积极解决",["解决问题","不走过场"]],["政府拒绝透露某些应公开信息",["未尊重群众知情权"]],["随便什么人都能做、不加甄别",["准入门槛低"]],["该登记注册的没登记且数量大",["政策宽松","监管不力"]],["聘请专家、培养某方面的人才",["人才队伍建设"]],["自发做某事",["自发","自愿","自觉性；积极主动性"]],["做好一件事有奖励，做不好有惩罚",["奖罚结合","有奖有罚","奖惩制度"]],["增加在家门口的工作机会",["增加就业岗位"]],["大学生/务工人员从城市回到乡村",["人才回流"]],["缺乏晋升空间/渠道",["晋升渠道"]],["百姓自己管自己的事情",["村民自治"]],["民众缺乏参与意识、积极性不高",["参与意识低"]],["加强培训，提高专业技能",["技能培训"]],["不懂……不会……",["知识匮乏"]],["发挥模范带头作用",["模范带头"]],["执法好不好，看看记录仪就知道",["执法记录规范化"]],["执法全过程都必须使用执法记录仪",["执法言行规范化"]],["一个人→一群人、个体→企业",["规模化","产业化"]],["事情还没有定论就开始做",["盲目投入","蛮干"]],["农产品经过加工包装后售卖",["增加产品附加值"]],["创新别家没有、独一无二的技术",["提高核心竞争力"]],["产品销往国外",["开拓国际市场","走出去战略"]],["一味迎合大众",["过度市场化"]],["鼓励公司、社会组织等投入金钱",["鼓励社会资本投入"]],["企业想在短期内获得高经济回报",["片面","过度追求短期利益"]],["原来只在本地销售，现在面向全国",["拓宽销售市场"]],["亲自去到某地了解情况",["实地走访","深入一线"]],["村里创办企业、公司",["创办集体企业"]],["通过加工处理，使产品更加优质",["提升产品品质"]],["企业产品不与业内对手雷同",["错位竞争"]],["短期内挣了钱，几年后光景大不相同",["不可持续"]],["发展创意农业/生态农业等",["新业态"]],["农村招商项目长期落不了地",["空头招商"]],["产品副产品变得多种多样",["丰富种类"]],["不能牺牲当地老百姓健康来建设项目",["重视健康"]],["资源禀赋好/充分利用自然资源",["资源禀赋"]],["出台相应的行业规范，规范市场秩序",["规范市场"]],["农产品营销渠道/销路单一",["渠道单一"]],["村集体收入来源单一",["收入单一"]],["扶贫项目单一",["项目单一"]],["加强品牌建设/实施品牌化发展",["品牌建设"]],["不同企业分别有不同优势，进行合作",["优势互补"]],["修建广场、宣传栏、阅览室等",["完善文化设施","加强基础设施建设"]],["让优秀文化融入普通老百姓的生活",["活化文化"]],["竹林和幼林下养兔、养鸡、养鸭等",["林下经济"]],["塑料袋、泡沫盒等废弃物污染环境",["乱排乱放"]],["某地文化站/图书馆等形同虚设",["设施利用率不足"]],["文化产品进口多、出口少",["文化逆差"]],["群众抵制不健康的外来文化",["文化自觉","文化自信"]],["越来越多人开始攀比、追求一夜暴富",["不良的社会风气"]],["无法查阅到相关信息",["信息公开不够透明"]]]; // [口语, [规范词...]]
  const STOP=new Set(('的 了 和 是 在 我 有 就 不 人 都 一个 我们 他们 你们 这 那 也 对 说 要 会 与 及 等 为 以 于 由 从 其 之 被 把 让 使 很 更 最 又 再 还 并 但 而 或 通过 进行 可以 一些 这个 那个 相关 有关 情况 方面 工作 问题 许多 一个个 之后 以后 目前 当前 进一步 不断 更加').split(' '));
  const GENERIC=/^(问题|情况|方面|工作|进行|加强|提高|发展|建设|管理|服务|体系|机制|制度|方式|模式|水平|能力)$/;
  const FILLERS=/我觉得|我认为|我个人|非常|特别地?|相当|越来越好|应该说|众所周知|可以说|总的来说|搞|弄好|抓好抓实|花大力气|说白了|反正|感觉|大家|啦|呗|挺/g;
  const WANNU=['加强宣传教育','加大宣传力度','完善法律法规','健全法律法规','加大资金投入','加大投入力度','提高思想认识','提高认识','加强监督管理','加强监管力度','建立健全机制','完善相关制度','完善体制机制','加强人才队伍建设','引起重视','高度重视'];
  const HOT=['中国式现代化','高质量发展','新质生产力','共同富裕','乡村振兴','数字中国','全过程人民民主','命运共同体','碳达峰','碳中和','基层治理','放管服','供给侧','营商环境','绿色发展'];
  const SUBJ=/政府|部门|街道|社区|村委会|村两委|党员干部|企业|学校|医院|平台|社会组织|志愿者|网格员|专门机构|领导小组|工作组|监管部门|执法(机关|部门)|主流媒体/g;
  const MEANS=/通过|依托|借助|建立|设立|组建|开展|组织|实施|推行|出台|搭建|引入|开设|举办|完善|修订|整合|搭建平台|购买服务|委托|签约|考核|督查|公示/g;
  const CONN=/因此|所以|由于|究其原因|一方面|另一方面|同时|此外|与此同时|综上|由此可见|这意味着|不仅|而且/g;
  const GENRES=[
    {k:/倡议书|公开信|宣传稿/,name:'倡议/宣传类',els:[['title','标题'],['salut','称谓'],['close','结尾号召'],['sign','落款']]},
    {k:/讲话稿|发言稿|主持词|演讲/,name:'讲话类',els:[['title','标题'],['salut','称谓'],['open','开场'],['close','结束语']]},
    {k:/短评|时评|评论|按语/,name:'评论类',els:[['title','标题'],['view','亮明观点']]},
    {k:/编者按/,name:'编者按',els:[['body','直接入文（编者按无标题）']]},
    {k:/通知|通告|通报/,name:'通知类',els:[['title','标题'],['salut','主送机关'],['sign','落款']]},
    {k:/调[研查]|汇报|报告(?!人)/,name:'报告类',els:[['title','标题'],['goal','背景目的'],['measures','情况与建议分条']]},
    {k:/工作方案|活动方案|方案/,name:'方案类',els:[['title','标题'],['goal','目的意义'],['measures','措施分条'],['sign','落款']]},
    {k:/建议书|意见/,name:'建议类',els:[['title','标题'],['salut','称谓'],['measures','建议分条'],['sign','落款']]},
  ];
  const cnNum=n=>['一','二','三','四','五','六','七','八','九','十'][n-1]||String(n);
  const norm=t=>String(t||'').replace(/[\s，。；：、！？“”‘’（）《》〈〉·—…,.:;!?()'"-]/g,'');
  /* 卷面字数：空格与换行不计，标点占格（与方格纸的计数一致） */
  const cc=t=>String(t||'').replace(/\s/g,'').length;
  function qType(q){
    const t=q.t||'';
    if(/写一篇(文章|文章。)|自拟题目|为题[，,]写一篇|写一篇议论文/.test(t))return 'zuowen';
    if(/倡议书|公开信|讲话稿|发言稿|短评|时评|评论|编者按|简报|通知|通告|报告|汇报|工作方案|建议书|宣传稿|提纲|主持词|导学|解说词|新闻稿/.test(t))return 'zhixing';
    if(/对策|建议|措施|如何解决|提出解决|整治方案/.test(t))return 'duice';
    if(/谈谈|理解|看法|分析|评价|启示|原因/.test(t))return 'zonghe';
    return 'guina';
  }
  const TYPE_NAME={guina:'归纳概括',zonghe:'综合分析',duice:'提出对策',zhixing:'贯彻执行',zuowen:'文章写作'};
  const WEIGHTS={guina:{A:.55,B:.15,C:.15,D:.10,E:.05},zonghe:{A:.30,B:.30,C:.10,D:.10,E:.20},duice:{A:.25,B:.20,C:.10,D:.10,E:.35},zhixing:{A:.25,B:.15,C:.15,D:.30,E:.15},zuowen:{A:.15,B:.20,C:.20,D:.15,E:.30}};

  function refMats(q,exam){
    const m=[...q.t.matchAll(/给定资料\s*([0-9一二三四五六七八九十１-９]+)/g)].map(x=>x[1]);
    const idxs=[];
    const cn={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'１':1,'２':2,'３':3,'４':4,'５':5,'６':6,'７':7,'８':8,'９':9};
    for(const x of m){const n=/\d/.test(x)?parseInt(x):cn[x];if(n&&n<=exam.m.length&&!idxs.includes(n-1))idxs.push(n-1)}
    if(!idxs.length)for(let i=0;i<exam.m.length;i++)idxs.push(i);
    return idxs;
  }
  function keyTerms(text,qtext){
    const freq=Object.create(null);
    const segs=norm(text).split('|');
    const raw=text.replace(/[\d\s，。；：、“”‘’（）()【】《》—…,.:;!?-]+/g,'|').split('|');
    for(const seg of raw){
      if(seg.length<2)continue;
      for(let n=2;n<=4;n++)for(let i=0;i+n<=seg.length;i++){
        const g=seg.slice(i,i+n);
        if(STOP.has(g)||/^[一二三四五六七八九十百千万亿日月年]+$/.test(g))continue;
        freq[g]=(freq[g]||0)+1;
      }
    }
    let cand=Object.keys(freq).filter(g=>freq[g]>=3&&!GENERIC.test(g)&&!/[的地得了着]/.test(g));
    cand.sort((a,b)=>freq[b]*b.length-freq[a]*a.length);
    const picked=[];
    for(const g of cand){
      if(picked.some(p=>p.includes(g)||g.includes(p)))continue;
      picked.push(g);
      if(picked.length>=16)break;
    }
    const qt=norm(qtext);
    return picked;
  }
  function copyRatio(ans,matText){
    const a=norm(ans);if(a.length<18)return 0;
    const m=norm(matText);let hit=0,tot=0;
    for(let i=0;i+16<=a.length;i+=5){
      tot++;
      if(m.includes(a.slice(i,i+16)))hit++;
    }
    return tot?hit/tot:0;
  }
  function items(ans){
    const lines=String(ans||'').split(/\n+/).flatMap(l=>l.split(/(?=[一二三四五六七八九十]+、|\d+[.、．])|；/)).map(s=>s.trim()).filter(s=>s.length>=4);
    const numbered=String(ans||'').match(/(^|\n)\s*(\d+[.、．]|[一二三四五六七八九十]+、|一是|二是|三是|四是|五是)/g)||[];
    return {list:lines,n:numbered.length};
  }
  // ---------- Skill A 采点覆盖官 ----------
  function skillA(q,exam,ans){
    const idxs=refMats(q,exam);
    const matText=idxs.map(i=>exam.m[i].p.join('')).join('');
    const terms=keyTerms(matText,q.t);
    const a=norm(ans);
    const hit=[],miss=[];
    for(const t of terms)(a.includes(t)?hit:miss).push(t);
    const cov=terms.length?hit.length/terms.length:0;
    const cr=copyRatio(ans,matText);
    let score=35+Math.round(63*Math.pow(cov,1.05));
    const issues=[],details=[];
    details.push('从材料提取 '+terms.length+' 个关键采点，命中 '+hit.length+' 个（覆盖率 '+(cov*100|0)+'%）');
    if(cr>0.45){score=Math.min(score,62);issues.push('照抄材料比例约 '+(cr*100|0)+'%：阅卷规则是照抄超 50% 的要点最高得一半分，请用归纳语言改写（采意不采点）');}
    else if(cr>0.25)issues.push('有 '+(cr*100|0)+'% 内容与材料原文高度重合，建议压缩转述');
    if(cov<0.35)issues.push('覆盖率偏低：遗漏的关键采点见下方清单，逐个回材料找对应表述');
    if(miss.length)details.push('遗漏采点（按重要度）：'+miss.slice(0,6).join('、'));
    if(hit.length)details.push('已覆盖：'+hit.slice(0,8).join('、'));
    const sugg=[];
    if(miss.length)sugg.push('回给定资料'+(idxs.map(i=>i+1).join('、'))+'补齐遗漏要点：'+miss.slice(0,4).join('、'));
    if(cr>0.3)sugg.push('把照抄原文的句子改写成"关键词+归纳动词"的自己的话');
    return {key:'A',name:'要点覆盖',score:Math.max(5,Math.min(98,score)),src:'SLB 批改标准 · 按点给分，采意不采点',
      headline:'关键采点覆盖率 '+(cov*100|0)+'%'+(cr>0.3?'，照抄率 '+(cr*100|0)+'% 需注意':''),
      details,issues,sugg};
  }
  // ---------- Skill B 结构逻辑官 ----------
  function skillB(q,exam,ans){
    const type=q._type;
    const lines=String(ans||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const it=items(ans);
    let score=42;const details=[],issues=[],sugg=[];
    if(it.n>=3){score+=18;details.push('分条作答 '+it.n+' 条，条理清晰，符合阅卷偏好');}
    else if(it.n>=1){score+=8;issues.push('仅有 '+it.n+' 处分条标记，建议明确分条（1. 2. 3. 或 一、二、三、）');}
    else{issues.push('通篇未分条：阅卷标准中"条理不清、没有分条作答"要扣 1–2 分');sugg.push('按"序号+关键词+具体阐述"分条重组答案');}
    const firstSen=(String(ans||'').split(/[。！？\n]/)[0]||'');
    if(/(主要|总体|共有|包括|如下|以下|表现|原因|在于)/.test(firstSen)&&firstSen.length>8){score+=10;details.push('开篇有总括句，先总后分');}
    else{issues.push('缺少总括句：第一句直接进入细节，建议先用一句话总括（如"主要有以下三方面原因："）');}
    const conns=(String(ans||'').match(CONN)||[]).length;
    if(conns>=3){score+=8;details.push('使用逻辑连接词 '+conns+' 处，链条清楚');}
    else issues.push('逻辑连接词不足（'+conns+' 处），层次感弱');
    if(type==='zonghe'){
      const hasWhat=/是指|含义|意在强调|反映的是|指的是/.test(ans),hasWhy=/原因|由于|源于|究其|背景|因为/.test(ans),hasHow=/应当|应该|建议|需要|要|应/.test(ans);
      const layers=[hasWhat,hasWhy,hasHow].filter(Boolean).length;
      score+=layers*7;details.push('逻辑链「是什么/为什么/怎么办」覆盖 '+layers+'/3 层');
      if(layers<3){issues.push('分析链缺 '+(3-layers)+' 层：标准结构为 是什么→为什么→怎么办');sugg.push('补全逻辑链缺口的那个层次，每层都要有材料依据');}
    }
    if(type==='duice'||type==='zhixing'){
      const withSubj=(String(ans||'').match(new RegExp(SUBJ.source,'g'))||[]).length;
      if(withSubj>=2){score+=8;details.push('出现执行主体 '+withSubj+' 处，责任落点明确');}
      else issues.push('对策缺少执行主体：每条应有"谁来做"（部门/机构/平台…）');
    }
    if(type==='zuowen'){
      const paras=lines.length;
      if(paras>=5){score+=14;details.push('全文 '+paras+' 段，结构完整');}else issues.push('仅 '+paras+' 段：议论文建议 5 段以上（开头-分论点×3-结尾）');
      const body=lines.slice(1,-1);
      const pivots=body.filter(p=>/^[^，。]{4,18}[，。]/.test(p)&&/是|要|应|需|方能|才能|离不开/.test(p.slice(0,20))).length;
      if(pivots>=2){score+=12;details.push('识别到 '+pivots+' 个观点句领起的分论点段');}
      else issues.push('分论点不明显：每段首句应是观点句（如"XX 是 XX 的根基"）');
      const tail=lines[lines.length-1]||'';
      if(/让我们|愿|相信|唯有|方能|未来/.test(tail)){score+=6;details.push('结尾有升华/号召');}
      else issues.push('结尾平淡：可用"让我们/唯有…方能…"式升华收束');
    }
    return {key:'B',name:'结构逻辑',score:Math.max(5,Math.min(98,score)),src:'kaogong-skill 题型结构标准 + SLB 逻辑链要求',
      headline:it.n>=3?'分条清晰，层次完整':'结构与条理还有明显提升空间',details,issues,sugg};
  }
  // ---------- Skill C 规范表达官 ----------
  function skillC(q,exam,ans){
    const a=String(ans||'');
    const vocabTerms=DATA.vocab.map(x=>x.term);
    const formalExtra=[];for(const[,fs]of ORAL)for(const f of fs)formalExtra.push(f);
    const OFFICIAL=['压实主体责任','压实责任','长效机制','健全机制','完善机制','强化监督','督查问责','畅通渠道','补齐短板','激发活力','统筹推进','形成合力','精细化管理','源头治理','多方参与','齐抓共管','宣传引导','舆论引导','顶层设计','分类施策','因地制宜','以人为本','服务下沉','网格化管理','一站式服务','放管服','营商环境','长效治理','常态化管理','公开透明','阳光运行','权责清单','容错纠错','问计于民','政企联动','城乡一体化'];
    const dict=[...new Set([...vocabTerms,...formalExtra,...OFFICIAL])].filter(t=>t.length>=3&&t.length<=16);
    const na=norm(a);
    const hits=[];
    for(const t of dict){if(na.includes(norm(t))&&!hits.some(h=>h.includes(t)||t.includes(h)))hits.push(t);if(hits.length>=24)break;}
    const density=hits.length/Math.max(1,na.length/100);
    let score=48+Math.min(40,Math.round(hits.length*5.5+density*6));
    const oralHits=[];
    for(const[o,fs]of ORAL){
      const on=norm(o);
      if(on.length>=4&&na.includes(on))oralHits.push([o,fs]);
      if(oralHits.length>=6)break;
    }
    const fill=(a.match(FILLERS)||[]).length;
    let penalty=oralHits.length*7+fill*4;
    score=Math.max(25,Math.min(96,score-penalty));
    const details=[],issues=[],sugg=[];
    details.push('命中规范词/官方表述 '+hits.length+' 处'+(hits.length?'：'+hits.slice(0,8).join('、')+(hits.length>8?' 等':''):''));
    if(oralHits.length){issues.push('发现 '+oralHits.length+' 处口语化表述');oralHits.forEach(([o,fs])=>sugg.push('「'+o+'」→ 改为「'+fs[0]+(fs[1]?'/'+fs[1]:'')+'」'));}
    if(fill)issues.push('口语填充词 '+fill+' 处（如"我觉得/非常/搞"）：申论要求语体规范，应删除');
    if(hits.length<3&&na.length>60){issues.push('规范表达密度低：多用词库里的规范词替代白描');sugg.push('去规范词库按场景找词，替换答案中的白话描述');}
    if(hits.length>=8)details.push('规范表达扎实，继续保持');
    return {key:'C',name:'规范表达',score:score,src:'kaogong-formalizer 口语→规范词映射 + 本地 420 词库',
      headline:oralHits.length?('发现 '+oralHits.length+' 处口语化，可替换为规范词'):'表达规范度良好',details,issues,sugg};
  }
  // ---------- Skill D 格式卷面官 ----------
  function skillD(q,exam,ans){
    const type=q._type;
    const li=q._li||{max:q.lm||0,min:0};
    const lim=li.max||0,lmin=li.min||0;
    const n=cc(ans);
    let score=100;const details=[],issues=[],sugg=[];
    if(lim){
      const ratio=n/lim;
      if(n>lim){const pen=Math.min(22,Math.round((n-lim)/lim*55));score-=pen;issues.push('超出字数上限 '+lim+' 字共 '+(n-lim)+' 字（约扣 '+pen+' 分当量）：删减修饰与重复，保留要点主干');}
      else if(ratio<0.6){const pen=Math.min(38,Math.round((1-ratio)*70));score-=pen;issues.push('仅写 '+n+' 字，不足 '+lim+' 字限值的 60%：内容单薄是硬伤，按要点给分会大面积失分');sugg.push('按每 2–3 分一个要点补足内容，目标写到位数的 85%–95%');}
      else if(ratio<0.85){score-=8;issues.push('字数 '+n+'/'+lim+'：还有约 '+(lim-n)+' 字空间，可再补 1–2 个要点');}
      else details.push('字数 '+n+'/'+lim+'，控制得当');
    }else if(lmin){
      if(n<lmin){const pen=Math.min(30,Math.round((1-n/lmin)*60));score-=pen;issues.push('题面要求不少于 '+lmin+' 字，现写 '+n+' 字：字数不足会直接掉档');}
      else details.push('字数 '+n+'，满足“不少于 '+lmin+' 字”的要求');
    }else if(type==='zuowen'){
      if(n<800){score-=30;issues.push('作文仅 '+n+' 字：不足 800 字按阅卷惯例要降档，务必写足');}
      else details.push('作文 '+n+' 字，篇幅达标');
    }
    const lines=String(ans||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const firstLine=lines[0]||'';
    let genre=null;
    for(const g of GENRES)if(g.k.test(q.t)){genre=g;break}
    if(genre&&type==='zhixing'){
      details.push('识别文种：'+genre.name);
      for(const[key,label]of genre.els){
        let ok=false;
        if(key==='title')ok=firstLine.length<=25&&firstLine.length>=2&&!/[。；]/.test(firstLine)&&lines.length>1;
        if(key==='salut')ok=/^[^\s，。：]{1,14}[：:]\s*$/m.test(ans)||/各位|亲爱的|^市民|^村民|^居民|^同学们|^朋友们/m.test(ans);
        if(key==='sign')ok=/(20\d{2}年)?\d{1,2}月\d{1,2}日/.test(ans.slice(-60))||/(局|办公室|委员会|中心|政府|村委会|社区|公司)\s*$/.test(lines[lines.length-1]||'');
        if(key==='open')ok=/大家好|各位|今天|很荣幸/.test(ans.slice(0,90));
        if(key==='close')ok=/谢谢|让我们|祝愿|希望|号召/.test(ans.slice(-120));
        if(key==='view')ok=/^(我认为|笔者认为)|说明|表明|观点/.test(firstLine)||/说明|表明|可见|本质/.test(ans.slice(0,120));
        if(key==='goal')ok=/为了|旨在|目的|围绕|按照/.test(ans.slice(0,150));
        if(key==='measures')ok=items(ans).n>=2;
        if(key==='body')ok=true;
        if(ok)details.push('✓ '+label+' 完整');
        else{score-=13;issues.push('缺'+label+'：'+genre.name+'的格式要素「'+label+'」未检出（格式分一般占 5–8 分）');}
      }
    }
    if(type==='zuowen'){
      const hasTitle=firstLine.length<=25&&!/[。；！]/.test(firstLine)&&firstLine.length>=2;
      if(hasTitle)details.push('✓ 有标题');
      else{score-=15;issues.push('缺标题或首行不像标题：作文无标题按惯例扣 2 分');sugg.push('第一行单独写标题，可用"主标题＋副标题"式');}
    }
    const punct=(String(ans||'').match(/[，。；：、]/g)||[]).length/Math.max(1,n);
    if(punct>0.3){score-=8;issues.push('标点密度偏高（卷面整洁度）：多为短句碎片，建议合并成完整表达');}
    if(/\.{3,}|……\s*。/.test(ans)){score-=6;issues.push('答案中残留省略号：正式作答不能写"…"，需写完整');}
    score=Math.max(10,Math.min(100,score));
    return {key:'D',name:'格式卷面',score:score,src:'SLB 贯彻执行格式分项 + 卷面整洁标准',
      headline:issues.length?('检出 '+issues.length+' 个格式/字数问题'):'格式规范，字数控制好',details,issues,sugg};
  }
  // ---------- Skill E 深度论证官 ----------
  function skillE(q,exam,ans){
    const type=q._type;
    const a=String(ans||'');const na=norm(a);
    const it=items(a);
    let score=52;const details=[],issues=[],sugg=[];
    if(type==='duice'||type==='zhixing'){
      const wannu=a.split(/[；\n]/).map(s=>s.trim()).filter(s=>WANNU.some(w=>norm(s).includes(norm(w))&&norm(s).length<norm(w).length+10));
      const total=it.list.length||1;
      const badRatio=Math.min(1,wannu.length/total);
      score-=Math.round(42*badRatio);
      if(wannu.length)issues.push('检出 '+wannu.length+' 条疑似万能对策（如「'+wannu[0].slice(0,18)+'」）：阅卷规则——万能对策每条最多得 1 分');
      const withBoth=(na.match(SUBJ)||[]).length>=2&&(na.match(MEANS)||[]).length>=2;
      const withMeans=(na.match(MEANS)||[]).length;
      const withNum=/\d|%|成以上|逐年/.test(a);
      if(withMeans>=3){score+=14;details.push('具体手段词 '+withMeans+' 处（建立/开展/引入…），操作性强');}
      else{issues.push('手段表述笼统：每条对策按「主体＋手段＋内容＋目的」公式展开');sugg.push('套用公式改写一条试试："XX部门（主体）应通过XX（手段），实现XX（内容），从而XX（目的）"');}
      if(withBoth){score+=10;details.push('主体与手段齐备');}
      if(withNum){score+=8;details.push('有数量/程度化表达，更显具体');}
    }
    if(type==='zuowen'){
      const examText=exam.m.map(m=>m.p.join('')).join('');
      const keyT=keyTerms(examText,q.t);
      const used=keyT.filter(t=>na.includes(t));
      const quotes=(a.match(/[「“][^」”]{4,26}[」”]/g)||[]).length;
      const hot=HOT.filter(h=>a.includes(h));
      const nums=(a.match(/\d+(?:\.\d+)?[%万余]?(?:多年|年|人|户|个)?/g)||[]).length;
      let ev=used.length*4+Math.min(12,nums*4)+quotes*6;
      score+=Math.min(34,ev)+Math.min(12,hot.length*6);
      details.push('调用材料关键词 '+used.length+' 个、数据表达 '+nums+' 处、引言 '+quotes+' 处、时政热词 '+hot.length+' 个'+(hot.length?'（'+hot.slice(0,3).join('、')+'）':''));
      if(used.length<2)issues.push('与材料的呼应少：大作文虽不能照抄，但论点须从材料立意中来，可化用材料关键词');
      if(nums===0&&quotes===0)issues.push('全文无论据支撑：缺数据、缺例证、缺引言，论证单薄会被压到三档');sugg.push('每个分论点配一个论据：材料案例的转述 / 政策数据 / 名言');
      if(hot.length>=2)details.push('时政热词运用恰当，是加分项');
    }
    if(type==='guina'||type==='zonghe'){
      const pureFacts=(a.match(/\d+(?:\.\d+)?[%万余年]?/g)||[]).length;
      if(pureFacts>=2){score+=6;details.push('保留 '+pureFacts+' 处关键数据，归纳更准确');}
      if(/本质|深层次|根源|实质|背后/.test(a)){score+=10;details.push('有透过现象看本质的表述');}
      else issues.push('停留在表面现象：可用"其本质是/深层次原因在于"提炼一层');
    }
    score=Math.max(15,Math.min(98,Math.round(score)));
    return {key:'E',name:'论证深度',score:score,src:'SLB 万能对策识别 + 大作文论据加分项',
      headline:issues.length?'具体性与论证深度待加强':'内容具体，论证有支撑',details,issues,sugg};
  }
  function inferMax(q,type){
      if(q&&typeof q.sc==='number'&&q.sc>0)return q.sc;
      const m=String(q&&q.t||'').match(/[（(]\s*(\d{1,3})\s*分\s*[)）]/);
      if(m){const v=+m[1];if(v>0&&v<=100)return v}
      return {guina:15,zonghe:20,duice:20,zhixing:25,zuowen:40}[type]||20;
    }
  function grade(q,exam,ans){
    const type=qType(q);
    q._type=type;
    const skills=[skillA(q,exam,ans),skillB(q,exam,ans),skillC(q,exam,ans),skillD(q,exam,ans),skillE(q,exam,ans)];
    const w=WEIGHTS[type];
    let comp=0;for(const s of skills)comp+=s.score*w[s.key];
    comp=Math.round(comp);
    const max=inferMax(q,type);
    const final=Math.round(comp/100*max*10)/10;
    let band;
    if(type==='zuowen')band=comp>=85?'一类文':comp>=70?'二类文':comp>=55?'三类文':'四类文';
    else band=comp>=80?'优秀':comp>=65?'良好':comp>=50?'合格':'待提高';
    const ranked=[...skills].sort((x,y)=>x.score-y.score);
    const top=[...new Set(ranked.slice(0,3).flatMap(s=>[...s.sugg,...s.issues]))].slice(0,4);
    return {type,typeName:TYPE_NAME[type],comp,final,max,band,skills,top,weights:w,at:new Date().toISOString(),n:cc(ans)};
  }
  const SKILL_NAME={A:'要点覆盖',B:'结构逻辑',C:'规范表达',D:'格式卷面',E:'论证深度'};
  function toText(r){
    const L=[];
    L.push('申论批改报告 · '+r.typeName+' · 总分 '+r.final+'/'+r.max+' 分（'+r.band+'）');
    L.push('＝'.repeat(24));
    const W=r.weights||WEIGHTS[r.type]||WEIGHTS.guina;
    const f1=v=>{const x=Math.round(v*10)/10;return x%1?x.toFixed(1):String(x)};
    for(const s of r.skills){
      L.push('');
      L.push('【'+(SKILL_NAME[s.key]||s.name)+'】 质量分 '+s.score+'/100 · 权重 '+Math.round(W[s.key]*100)+'% → 得 '+f1(s.score/100*W[s.key]*r.max)+' / '+f1(W[s.key]*r.max)+' 分');
      L.push('  '+s.headline);
      for(const d of s.details)L.push('  · '+d);
      for(const i of s.issues)L.push('  ▲ '+i);
      for(const g of s.sugg)L.push('  → 建议：'+g);
    }
    L.push('');
    L.push('【优先改进】');
    r.top.forEach((t,i)=>L.push((i+1)+'. '+t));
    L.push('');
    L.push('—— 本机规则估分，仅供参考');
    return L.join('\n');
  }
  return {grade,toText,qType,TYPE_NAME,SKILL_NAME,norm,cc,W:WEIGHTS,inferMax};
})();
window.GRADE=GRADE;

  const WS={exam:null,matIdx:0,qIdx:0,brush:'y',loaded:new Set(),ansLoaded:new Set(),ansFailed:new Set(),timer:null,ann:null,saveT:null};
  let WSANN=null;
  function wsLoadGroup(grp){
    return new Promise(res=>{
      if(WS.loaded.has(grp)||window.SH_EXAMS&&window.SH_EXAMS.some(e=>e._grp===grp)) return res();
      const s=document.createElement('script');
      s.src='exams/'+grp+'.js';
      s.onload=()=>{ (window.SH_EXAMS||[]).forEach(e=>{if(e._grp===undefined)e._grp=grp;wsNormalize(e)}); WS.loaded.add(grp); res(); };
      s.onerror=()=>res();
      document.head.appendChild(s);
    });
  }
  function wsGetExam(id){ return (window.SH_EXAMS||[]).find(e=>e.id===id); }
  /* 少数省考卷把同一年多套卷合并在一个文件里，出现完全相同的题目：去重，避免出现两个一模一样的分页 */
  function wsNormalize(e){
    if(!e||e._norm)return e;
    e._norm=1;
    if(!Array.isArray(e.q))e.q=[];
    const seen={},out=[];
    e.q.forEach(q=>{
      const k=String(q&&q.t||'').replace(/\s/g,'');
      if(k&&seen[k])return;
      if(k)seen[k]=1;
      out.push(q);
    });
    e.q=out;
    return e;
  }
  function wsQCount(x){const e=wsGetExam(x.id);return e&&e.q?e.q.length:(x.q||0)}
  function wsOptLabel(x){return x.r+' '+x.y+(x.l?' · '+x.l:'')+'（'+wsQCount(x)+' 题 / '+(x.c/10000).toFixed(1)+'万字）'}
  function wsRefreshSelectLabel(ex){
    const sel=$('#ws-exam');if(!sel||!ex)return;
    const o=Array.prototype.slice.call(sel.options).filter(x=>x.value===ex.id)[0];
    if(o)o.textContent=wsOptLabel(ex);
  }
  function wsLS(){ return JSON.parse(LS.getItem('sh_ws_ans')||'{}'); }
  function wsAnsKey(){ return 'sh_ws_'+(WS.exam?WS.exam.id:'x'); }
  /* 部分试卷（多卷合并的省考卷）里题号 no 会重复，用 no 当键会把不同题的作答/批改互相覆盖。
     这里以“题序”为键：只有重复题号才加后缀，老数据仍按原题号读取，不需要迁移。 */
  function wsQKey(exam,i){
    const q=exam.q[i];if(!q)return '0';
    const dup=exam.q.filter(x=>x.no===q.no).length>1;
    return dup?q.no+'#'+i:String(q.no);
  }
  function wsFirstOfNo(exam,i){const q=exam.q[i];return exam.q.findIndex(x=>x.no===q.no)===i;}
  function wsAnsGet(exam,i){
    const b=wsLS()[exam.id]||{},k=wsQKey(exam,i);
    if(b[k]!=null)return b[k];
    const q=exam.q[i];
    return wsFirstOfNo(exam,i)?(b[String(q.no)]||''):'';
  }
  function wsAnsSet(exam,i,v){
    const all=wsLS();if(!all[exam.id])all[exam.id]={};
    all[exam.id][wsQKey(exam,i)]=v;LS.setItem('sh_ws_ans',JSON.stringify(all));
  }
  function wsGradeAll(exam){return JSON.parse(LS.getItem('sh_ws_grade_'+exam.id)||'{}')}
  function wsGradeGet(exam,i){
    const st=wsGradeAll(exam),k=wsQKey(exam,i);
    if(st[k])return st[k];
    const q=exam.q[i];
    return wsFirstOfNo(exam,i)?(st[String(q.no)]||null):null;
  }
  /* 字数上下限：数据里的 lm 不完整（55 道缺 lm，个别还把千字作文写成 250 字），
     所以以“题干/要求”里写明的字数为准，lm 只在题面没写时兜底。 */
  function wsLimitInfo(q){
    if(q._li)return q._li;
    const txt=((q&&q.rq)||'')+' '+((q&&q.t)||'');
    let pmin=0,pmax=0,m;
    if((m=txt.match(/(\d{3,4})\s*[～~—\-－至到]\s*(\d{3,4})\s*字?/))){pmin=+m[1];pmax=+m[2]}
    else if((m=txt.match(/(?:不少于|不低于|至少)\s*(\d{3,4})\s*字/)))pmin=+m[1];
    else if((m=txt.match(/(?:不超过|不多于|不高于)\s*(\d{3,4})\s*字/)))pmax=+m[1];
    else if((m=txt.match(/(\d{3,4})\s*字\s*(?:以内|以下)/)))pmax=+m[1];
    else if((m=txt.match(/(\d{3,4})\s*字\s*左右/)))pmax=Math.round(+m[1]*1.1);
    let max=q&&q.lm>0?q.lm:0,min=0;
    if(pmax){
      if(!max||Math.abs(pmax-max)>Math.max(100,max*0.5))max=pmax;
      min=pmin||0;
    }else if(pmin){
      min=pmin;
      max=(max>pmin*1.2)?max:0;      // 只写“不少于”的题不设上限
    }
    const info={max:max||0,min:min||0};q._li=info;return info;
  }
  function wsGetAnn(){ if(WSANN) return WSANN.load(); if(!WS.ann) WS.ann=JSON.parse(LS.getItem(wsAnsKey()+'_hl')||'{"ops":[]}'); return WS.ann; }
  function wsSaveAnn(){ if(WSANN){WSANN.save();return} if(WS.exam) LS.setItem(wsAnsKey()+'_hl',JSON.stringify(wsGetAnn())) }
  function wsRenderMaterial(){
    const box=$('#ws-material');
    const mat=WS.exam.m[WS.matIdx];
    const head='<div class="src noind">给定资料 '+(WS.matIdx+1)+'</div>';
    wsCancelAnim();
    const keepPage=Math.round(box.scrollLeft/(WS.step||1));
    box.innerHTML = head + (window.KL ? KL.renderParas(WS.matIdx, mat.p, wsGetAnn()) : esc(mat.p.join('\n')));
    wsLayoutColumns();
    box.scrollLeft=keepPage*(WS.step||1);
    wsUpdatePage();
    wsAnnCount();
  }
  function wsAnnCount(){
    const n=KL.countOps(wsGetAnn().ops,WS.matIdx);
    const el=$('#ws-hl-count'); if(el) el.textContent='标注 '+n+' 处';
    const now=$('#ws-ann-now');
    if(now) now.innerHTML=wsBrushNow();
    wsSyncFloat();
  }
  function wsBrushNow(){return '<i class="kk-dot '+WS.brush+'"></i>'+(WS.brush==='x'?'橡皮':(KL.NAME[WS.brush]||'黄')+'笔')}
  function wsInnerW(box){const cs=getComputedStyle(box);return box.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)}
  const wsNarrow=()=>!!(window.matchMedia&&window.matchMedia('(max-width:760px)').matches);
  function wsLayoutColumns(){
    const box=$('#ws-material');if(!box)return;
    if(wsNarrow()){box.style.columnWidth='';box.style.columnGap='';WS.step=0;return}
    const vw=window.innerWidth||960;
    let gap=parseFloat(getComputedStyle(box).columnGap)||34;
    if(vw<=760) gap=Math.min(gap,16);
    else if(vw<=900) gap=Math.min(gap,22);
    const innerW=Math.max(200,wsInnerW(box));
    WS.colGap=gap;WS.step=innerW+gap;
    box.style.columnWidth=innerW+'px';box.style.columnGap=gap+'px';
    if(vw<=760) box.style.columnFill='auto';
  }
  function wsPages(){
    const box=$('#ws-material');
    if(!box||!WS.step)return{now:1,total:1,step:1};
    const step=WS.step;
    const total=Math.max(1,Math.round((box.scrollWidth+WS.colGap)/step));
    const now=Math.max(1,Math.min(total,Math.round(box.scrollLeft/step)+1));
    return{now,total,step};
  }
  function wsUpdatePage(){const p=wsPages();const el=$('#ws-page-ind');if(el)el.textContent=p.now+' / '+p.total}
  function wsCancelAnim(){if(WS.anim&&WS.anim.raf)cancelAnimationFrame(WS.anim.raf);WS.anim=null;WS.animming=false}
  function wsEase(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function wsAnimTo(pageIdx){
    const box=$('#ws-material');if(!box)return;
    const p=wsPages();
    const clamped=Math.max(0,Math.min(p.total-1,pageIdx));
    const target=clamped*p.step;
    if(Math.abs(box.scrollLeft-target)<2){box.scrollLeft=target;wsUpdatePage();return}
    wsCancelAnim();
    const from=box.scrollLeft,dist=Math.abs(target-from);
    const dur=Math.min(480,190+dist*0.14);
    WS.anim={from:from,to:target,t0:performance.now(),dur:dur};
    WS.animming=true;
    const tick=now=>{
      const a=WS.anim;if(!a){return}
      const t=Math.min(1,(now-a.t0)/a.dur);
      box.scrollLeft=a.from+(a.to-a.from)*wsEase(t);
      wsUpdatePage();
      if(t<1)a.raf=requestAnimationFrame(tick);
      else{box.scrollLeft=a.to;WS.anim=null;WS.animming=false;wsUpdatePage()}
    };
    WS.anim.raf=requestAnimationFrame(tick);
  }
  function wsSnapTo(pageIdx,instant){
    const box=$('#ws-material');if(!box)return;
    if(instant){wsCancelAnim();const p=wsPages();box.scrollLeft=Math.max(0,Math.min(p.total-1,pageIdx))*p.step;wsUpdatePage();return}
    wsAnimTo(pageIdx);
  }
  function wsGoPage(dir){const box=$('#ws-material');if(!box)return;wsSnapTo(wsPages().now-1+dir,false)}
  function wsExamLabel(ex){return ex.r+' '+ex.y+(ex.l?' · '+esc(ex.l):'')}
  function wsUpdatePickBtn(){const b=$('#ws-exam-pick');if(b&&WS.exam)b.querySelector('.xp-label').textContent=(WS.exam.r+' '+WS.exam.y+(WS.exam.l?' · '+WS.exam.l:''))}
  function wsPickerOpen(){
    const p=$('#ws-picker');p.hidden=false;requestAnimationFrame(()=>p.classList.add('show'));
    $('#pm-q').value='';$('#pm-chips').dataset.reg='全部';
    wsPickerRender();if(!wsNarrow())setTimeout(()=>$('#pm-q').focus(),60);const cur=$('#pm-list .pm-item.cur');if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'center'});
  }
  function wsPickerClose(){const p=$('#ws-picker');if(!p||p.hidden)return;p.classList.remove('show');setTimeout(()=>{p.hidden=true},220)}
  function wsPickerRender(){
    const idx=window.SH_EXAM_INDEX||[];
    const chips=$('#pm-chips');
    if(!chips.dataset.reg)chips.dataset.reg='全部';
    if(!chips.children.length){
      const regions=[...new Set(idx.map(x=>x.r))].sort((a,b)=>a==='国考'?-1:b==='国考'?1:a.localeCompare(b,'zh'));
      chips.innerHTML=['全部'].concat(regions).map(r=>'<button class="pm-chip'+(r==='全部'?' on':'')+'" data-r="'+esc(r)+'">'+esc(r)+(r==='全部'?'':' <i>'+idx.filter(x=>x.r===r).length+'</i>')+'</button>').join('');
    }
    const reg=chips.dataset.reg,kw=($('#pm-q').value||'').trim().toLowerCase();
    let rows=idx.filter(x=>(reg==='全部'||x.r===reg)&&(!kw||((x.r+' '+x.y+' '+(x.l||'')+' '+x.id).toLowerCase().includes(kw))));
    rows.sort((a,b)=>a.r===b.r?b.y-a.y:(a.r==='国考'?-1:b.r==='国考'?1:a.r.localeCompare(b.r,'zh')));
    $('#pm-total').textContent=idx.length+' 套';
    $('#pm-count').textContent=(reg!=='全部'?reg+' · ':'')+rows.length+' 套';
    const cur=WS.exam?WS.exam.id:null,ansAll=wsLS();
    const doneOf=x=>{const a=ansAll[x.id];if(!a)return 0;return Object.keys(a).filter(k=>String(a[k]||'').replace(/\s/g,'').length>0).length};
    $('#pm-list').innerHTML=rows.length?rows.map(x=>'<button class="pm-item'+(x.id===cur?' cur':'')+'" data-id="'+esc(x.id)+'"><span class="pi-t">'+esc(x.r)+' '+x.y+(x.l?' · '+esc(x.l):'')+'</span>'+(x.id===cur?'<span class="pi-cur">当前</span>':'')+(doneOf(x)?'<span class="pi-done">已答 '+Math.min(doneOf(x),wsQCount(x))+'/'+wsQCount(x)+'</span>':'')+'<span class="pi-m">'+wsQCount(x)+' 题 · '+(x.c/10000).toFixed(1)+' 万字</span></button>').join(''):'<div class="pm-empty">没有找到。换个省份或年份试试。</div>';
  }
  function wsPickerPick(id){
    if(WS.exam&&WS.exam.id===id){wsPickerClose();return}
    const sel=$('#ws-exam');sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));
    wsPickerClose();
  }
  $('#ws-exam-pick').addEventListener('click',wsPickerOpen);
  $('#pm-close').addEventListener('click',wsPickerClose);
  $('#ws-picker .pm-mask').addEventListener('click',wsPickerClose);
  $('#pm-chips').addEventListener('click',e=>{const c=e.target.closest('.pm-chip');if(!c)return;const chips=$('#pm-chips');chips.dataset.reg=c.dataset.r;chips.querySelectorAll('.pm-chip').forEach(x=>x.classList.toggle('on',x===c));wsPickerRender()});
  $('#pm-q').addEventListener('input',wsPickerRender);
  $('#pm-q').addEventListener('keydown',e=>{if(e.key==='Enter'){const f=$('#pm-list .pm-item');if(f)wsPickerPick(f.dataset.id)}});
  $('#pm-list').addEventListener('click',e=>{const it=e.target.closest('.pm-item');if(it)wsPickerPick(it.dataset.id)});
  function wsGradeStore(){return wsGradeAll(WS.exam)}
  function wsShowSavedReport(){
    const cue=$('#ws-gradecue');if(!cue||!WS.exam)return;
    const r=wsGradeGet(WS.exam,WS.qIdx);
    if(r){cue.hidden=false;cue.innerHTML='<span>上次批改 <b>'+r.final+'</b> / '+r.max+' 分 · '+r.band+'</span><button class="mini-btn" id="ws-gradecue-open">看报告</button>';$('#ws-gradecue-open').addEventListener('click',()=>wsShowReport(r))}
    else cue.hidden=true;
  }
  function wsModalOpen(){const p=$('#ws-grade');if(!p)return;p.hidden=false;requestAnimationFrame(()=>p.classList.add('show'))}
  function wsModalClose(){const p=$('#ws-grade');if(!p||p.hidden)return;p.classList.remove('show');setTimeout(()=>{p.hidden=true},220)}
  function wsShowReport(r){wsModalOpen();$('#grm-type').textContent=r.typeName;wsRenderReport(r,false);const b=$('#ws-grade .grm-body');if(b)b.scrollTop=0}
  $('#grm-close').addEventListener('click',wsModalClose);
  $('#ws-grade .grm-mask').addEventListener('click',wsModalClose);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#ws-grade').hidden)wsModalClose();if(e.key==='Escape'&&!$('#ws-ref').hidden)wsRefClose();if(e.key==='Escape'&&!$('#ws-picker').hidden)wsPickerClose()});
  $('#ws-grade-btn').addEventListener('click',()=>{
    if(!WS.exam||WS.grading)return;
    const txt=wsAnswerText().trim();
    if(GRADE.cc(txt)<20){toast('至少写 20 个字再批改');return}
    const q=WS.exam.q[WS.qIdx];
    const exId=WS.exam.id, qi=WS.qIdx;   // 批改过程中切题/切卷时不要把报告写到别的题上
    wsLimitInfo(q);                 // 批改要用到字数上下限（部分题目标注缺失时就地推断）
    wsFlushSave();
    WS.grading=true;
    wsModalOpen();
    $('#grm-type').textContent=GRADE.TYPE_NAME[GRADE.qType(q)]||'';
    const body=$('#ws-grade .grm-body');
    body.innerHTML='<div class="gr-working"><i class="gr-spin"></i>正在批改…</div>';
    body.scrollTop=0;
    /* 评分在本机完成；留一小段时间让浮层先稳定展开，再出结果 */
    WS.gradingT=setTimeout(()=>{
      const report=GRADE.grade(q,WS.exam,txt);
      WS.grading=false;
      const all=JSON.parse(LS.getItem('sh_ws_grade_'+exId)||'{}');
      all[wsQKey(wsGetExam(exId)||WS.exam,qi)]=report;
      LS.setItem('sh_ws_grade_'+exId,JSON.stringify(all));
      if(!WS.exam||WS.exam.id!==exId||WS.qIdx!==qi)return;   // 已经切走了：静默存盘，不弹报告
      wsRenderReport(report,true);
      wsRenderQuestion();wsShowSavedReport();wsTabBadges();
    },360);
  });
  function wsRenderReport(r,fresh){
    const body=$('#ws-grade .grm-body');if(!body)return;
    const W=r.weights||GRADE.W[r.type]||GRADE.W.guina;
    const f1=v=>{const x=Math.round(v*10)/10;return x%1?x.toFixed(1):String(x)};
    const lv=s=>s.score>=85?4:s.score>=70?3:s.score>=55?2:1;
    const li=d=>'<li class="'+(d[0]==='▲'?'warn':d[0]==='→'?'fix':'')+'">'+esc(d.replace(/^[▲→✓]\s*/,''))+'</li>';
    const sk=r.skills.map(s=>'<div class="gr-skill"><div class="gr-skill-head"><b>'+(GRADE.SKILL_NAME[s.key]||esc(s.name))+'</b><span class="gr-sp s'+lv(s)+'">'+f1(s.score/100*W[s.key]*r.max)+'<em>/ '+f1(W[s.key]*r.max)+'</em></span></div>'
        +'<div class="gr-bar"><i class="s'+lv(s)+'" data-w="'+s.score+'"></i></div>'
        +'<div class="gr-verdict">'+esc(s.headline)+'</div>'
        +'<ul class="gr-list">'+s.details.map(li).join('')+s.issues.map(d=>li('▲ '+d)).join('')+s.sugg.map(d=>li('→ '+d)).join('')+'</ul></div>').join('');
    let when='刚刚批改';
    if(!fresh&&r.at){const d=new Date(r.at);if(!isNaN(d))when=(d.getMonth()+1)+'月'+d.getDate()+'日 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' 批改'}
    body.innerHTML='<div class="gr-card">'
      +'<div class="gr-head"><div class="gr-total"><b>'+r.final+'</b><span>/ '+r.max+' 分</span></div>'
      +'<div class="gr-headside"><div class="gr-band"><span class="pill main">'+r.band+'</span><span class="pill">'+(r.n||0)+' 字</span></div><div class="gr-sub">'+when+'</div></div></div>'
      +(r.top.length?'<div class="gr-top"><b>先改这几处</b><ol>'+r.top.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol></div>':'')
      +'<div class="gr-skills">'+sk+'</div>'
      +'<div class="gr-actions"><button class="mini-btn accent" id="gr-ref">对照参考答案</button><button class="mini-btn" id="gr-copy">复制报告</button><button class="mini-btn" id="gr-again">重新批改</button></div>'
      +'<p class="gr-note">分数由本机规则估算，按要点、结构、表达、格式、论证五项加权（'+['A','B','C','D','E'].map(k=>Math.round(W[k]*100)+'%').join(' / ')+'），和真实阅卷有差距，仅供参考。重新批改会覆盖这次结果。</p>'
      +'</div>';
    requestAnimationFrame(()=>{body.querySelectorAll('.gr-bar i').forEach(b=>b.style.width=b.dataset.w+'%')});
    $('#gr-copy').addEventListener('click',()=>copy(GRADE.toText(r),'报告已复制'));
    $('#gr-again').addEventListener('click',()=>{$('#ws-grade-btn').click()});
    $('#gr-ref').addEventListener('click',()=>{wsModalClose();setTimeout(()=>{wsUpdateRefBtn();wsRefOpen()},240)});
  }
/* ================= 参考答案与要点自检 =================
 * 答案数据由 tools/answers/build_answers.py 生成，按「试卷 ID + 题序」对齐。
 * 匹配规则：题干相似度 + 材料重合度双重校验，分 high / mid / loose 三档。
 */
const REF_SRC={
  gwy:{name:'gwy-zhenti · 粉笔题库',repo:'https://github.com/ProfessorZhi/gwy-zhenti',branch:'main'},
  fenbi:{name:'gongkao-tiku · 申论题库',repo:'https://github.com/zzcc-nb/gongkao-tiku',branch:'master'},
  jigou:{name:'国考机构解析 2022–2026',repo:'https://github.com/h1neolzr7f/guokao-real-exams-2022-2026',branch:'main'},
  pdf:{name:'gongkao-zhenti-knowledge',repo:'https://github.com/36hxqw/gongkao-zhenti-knowledge',branch:'main'}
};
const REF_TIER={
  high:['已核对','题干和材料都对得上'],
  mid:['基本吻合','题干或材料只有部分对得上，建议再核对一遍'],
  loose:['仅供参考','只有题干相近，不一定是这道题的答案']
};
const REF_DIMS=['立意和范文方向一致','结构完整：标题、开头、分论点、结尾','每个分论点都有材料或事例支撑','语言规范，没有明显的口语'];
function wsAnsGrp(){
  const id=WS.exam?WS.exam.id:'';
  const m=(window.SH_EXAM_INDEX||[]).find(x=>x.id===id);
  return (m&&m.grp)||(WS.exam&&WS.exam._grp)||'gk';
}
function wsLoadAnswers(){
  if(!WS.ansLoaded) WS.ansLoaded=new Set();
  if(!WS.ansFailed) WS.ansFailed=new Set();
  const grp=wsAnsGrp();
  if(window.SH_ANSWERS&&WS.exam&&window.SH_ANSWERS[WS.exam.id]) return Promise.resolve(true);
  if(WS.ansLoaded.has(grp)) return Promise.resolve(!!(window.SH_ANSWERS&&WS.exam&&window.SH_ANSWERS[WS.exam.id]));
  WS.ansLoaded.add(grp);
  return new Promise(res=>{
    const s=document.createElement('script');
    s.src='exams/answers-'+grp+'.js';
    s.onload=()=>{WS.ansFailed.delete(grp);wsUpdateRefBtn();res(true)};
    s.onerror=()=>{WS.ansLoaded.delete(grp);WS.ansFailed.add(grp);wsUpdateRefBtn();res(false)};
    document.head.appendChild(s);
  });
}
function wsAnsAt(exam,i){
  if(!exam) return null;
  const arr=(window.SH_ANSWERS||{})[exam.id];
  if(!arr) return null;
  if(arr[i]) return arr[i];
  const q=exam.q[i];
  if(exam.q.filter(x=>x.no===q.no).length>1) return null;
  return arr.find(x=>x&&String(x.no)===String(q.no))||null;
}
function wsRefAll(exam){try{return JSON.parse(LS.getItem('sh_ws_ref_'+exam.id)||'{}')}catch(e){return{}}}
function wsRefGet(exam,i){const st=wsRefAll(exam);return st[wsQKey(exam,i)]||null}
function wsRefSet(exam,i,v){const st=wsRefAll(exam);st[wsQKey(exam,i)]=v;LS.setItem('sh_ws_ref_'+exam.id,JSON.stringify(st))}
function wsUpdateRefBtn(){
  const b=$('#ws-ref-btn');
  if(!b||!WS.exam) return;
  const loaded=!!(window.SH_ANSWERS&&window.SH_ANSWERS[WS.exam.id]);
  const failed=WS.ansFailed&&WS.ansFailed.has(wsAnsGrp());
  const a=loaded?wsAnsAt(WS.exam,WS.qIdx):null;
  const seen=loaded?wsRefGet(WS.exam,WS.qIdx):null;
  const st=$('#ws-ref-state');
  if(!loaded){
    b.textContent=failed?'答案加载失败，点此重试':'参考答案';
    b.title='';
    if(st) st.innerHTML='';
    return;
  }
  b.innerHTML=a?((seen&&seen.seen?'<i class="ws-refdot"></i>':'')+'参考答案'):'暂无参考答案';
  b.title=a?(seen&&seen.seen?'已看过参考答案':''):'这道题在公开题库里没有找到可靠的答案';
  if(st) st.innerHTML='';
}
/* ---------- 参考答案：把「正文」和「说明」拆开 ----------
 * 题库的解析字段常把三样东西混在一起：
 *   1) 答案正文（分条列点、公文版式、范文段落）——这是要看的真实答案；
 *   2) 参考答案说明——为什么这么分条、每处踩的是哪个得分点；
 *   3) 范文点评（「文章分析」「【标题的优点：…】」）——逐段评优点。
 * 面板里三者分开：正文按条排版，「说明 / 点评」各自收进折叠块。
 * 题库的写法很随便：说明可能接在答案末尾、夹在段落中间，前后没有固定标记，
 * 也可能压根找不到标记。所以这里按「位置 + 用词」两条线索判断。
 */
const REF_NOISE_RE=/^(来源[:：]|>|粉笔页面)/;
/* 整段开头就是说明（如题库把说明单独存成一条「答案」） */
const REF_NOTE_START=/^(参考答案说明|答案说明|评分说明)\s*[:：]/;
/* 「参考答案一 / 参考范文2 / 答案三」这种版本标记行不算说明 */
const REF_VARIANT_RE=/^(参考)?(答案|范文)\s*([一二三四五六七八九十\d]+)\s*[:：]?$/;
/* 完整句子里提到的「参考答案说明」不算标记（避免把答案正文切坏） */
const REF_NOTE_AT_LINE=/^[\s。；：:]*(参考答案说明|答案说明|评分说明)\s*[:：]/;
const REF_NOTE_HEAD=/^(参考答案|答案|评分|阅卷)?(说明|解析|点评|评析)\s*[:：]?/;
const REF_NOTE_LEAD=/参考答案说明|答案说明|评分说明|答案要点/;
/* 说明类文字的特征词：出现两个以上才算说明，避免把答案正文误判 */
const REF_NOTE_CUES=/本参考答案|参考答案|答案要点|得分点|采分点|分条撰写|阅卷|评分|条理较为清晰|要点之间|本题要求|思路方面|格式方面|内容方面|形式上/;
function refClean(t){return String(t||'').replace(/\\([\\`*_{}\[\]()#+\-.!~|>])/g,'$1');}
function refInline(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');}
function refCueCount(t){const m=String(t||'').match(new RegExp(REF_NOTE_CUES.source,'g'));return m?m.length:0;}
/* 一整段都是说明吗（不是答案的分条内容） */
function refIsNoteBlock(t){
  const x=String(t||'').trim();
  if(!x) return false;
  if(REF_NOISE_RE.test(x)) return true;
  if(REF_NOTE_HEAD.test(x)) return true;
  if(/^【[^【】]{4,}(】|$)/.test(x)) return true;            /* 范文点评 */
  if(/^(注意|提示|小结)[:：]/.test(x)) return true;
  return false;
}
/* 大作文的「文章分析 / 范文分析」标记，可能独占一行，也可能紧跟在段落末尾 */
const REF_FX_HEAD=/(?:^|[\n。！？…”』）)]|……)\s*(?:文章分析|范文分析|范文点评|参考解析)\s*[一二三四五\d]?\s*[:：]?/g;
/* 审题 / 答题思路：整块都是思路，不是答案 */
function refLooksLikeThinking(t){
  const x=String(t||'');
  if(/【审题及答题思路】|【审题|答题思路】/.test(x)) return true;
  const brackets=(x.match(/【[^】]*】/g)||[]).length;
  return brackets>=2 && x.length<1400 && /(归纳|概括|对策|启示|解释|公文|文种|字数|要求[:：])/.test(x);
}
function refSplitBody(t){
  let raw=refClean(t);
  let kind='',note=[];
  /* 0) 只有「参考答案说明」没有答案：别把说明当成答案显示 */
  if(REF_NOTE_START.test(raw)&&raw.length<900){
    return {body:[],note:[raw.trim()],kind:'note'};
  }
  /* 1) 审题与答题思路：整块都不是答案 */
  if(refLooksLikeThinking(raw)){
    return {body:[],note:[raw.trim()],kind:'shenti'};
  }
  /* 2) 文章分析：从标记处切开（标记前若只有一个句号也认） */
  REF_FX_HEAD.lastIndex=0;
  let fx=null,m;
  while((m=REF_FX_HEAD.exec(raw))){ if(m.index>60){fx=m;break} }
  if(fx){
    const head=raw.slice(0,fx.index).trim();
    const tail=raw.slice(fx.index).replace(/^(?:[\n。！？…”』）)]|……)\s*/,'').trim();
    if(head.length>40&&tail.length>40){
      raw=head;
      note=[tail.replace(/^(文章分析|范文分析|范文点评|参考解析)\s*[一二三四五\d]?\s*[:：]?/,'').trim()];
      kind='fenxi';
    }
  }
  /* 3) 参考答案说明：逐块判断，不整段切（同一段里常有「参考答案二」等另一版答案） */
  let body=[];
  let seenVariant=false;   /* 已经遇到「参考答案二 / 参考范文2」：之后的内容是另一版答案 */
  raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).forEach(bk=>{
    if(REF_NOISE_RE.test(bk)) return;
    const vm=bk.replace(/[:：]\s*$/,'').match(REF_VARIANT_RE);
    if(vm){ if(!/^(一|1|１)$/.test(vm[2]||'')) seenVariant=true; body.push(bk);return}
    /* 范文点评块：夹在范文段落里的【…】或「注意：…」 */
    if(/【[^【】]{4,}(】|$)/.test(bk)||/^(注意|提示)[:：]/.test(bk)){
      note.push(bk.replace(/^【/,'').replace(/】$/,''));kind=kind||'fenxi';return;
    }
    /* 一段里前半是答案、后半是「参考答案说明：…」：先在块内切开 */
    const sp=bk.search(/(^|\n)[ \t]*(参考答案说明|答案说明|评分说明)\s*[:：]/);
    if(sp>40&&/^[\s]*(参考答案说明|答案说明|评分说明)/.test(bk.slice(sp).replace(/^\n/,''))){
      body.push(bk.slice(0,sp).trim());
      note.push(bk.slice(sp).trim());kind=kind||'note';return;
    }
    /* 整段都是说明（带标记，或整段以说明口吻写成） */
    const itemStart=REF_ITEM_RE.test(bk);
    if(refIsNoteBlock(bk)||(!seenVariant&&!itemStart&&bk.length<700&&refCueCount(bk)>=3&&REF_NOTE_LEAD.test(bk))){
      note.push(bk);kind=kind||'note';return;
    }
    body.push(bk);
  });
  note=note.map(n=>n.split(/\n{2,}/).filter(x=>!REF_NOISE_RE.test(x.trim())).join('\n\n').trim()).filter(Boolean);
  return {body,note,kind};
}
function refIsDocTitle(b){
  if(b.length>30||/\n/.test(b))return false;
  return /^(关于|致|给)/.test(b)||/^.{2,20}(简报|通报|公告|通知|报告|纪要|方案|提纲|倡议书|公开信|宣传稿|短评|讲话稿|主持词|启事|编者按|建议书|致辞|说明|材料)$/.test(b);
}
function refBlockHTML(b){
  b=b.trim();if(!b)return '';
  if(/^(参考答案|参考范文|范文|答案)[一二三四五六七八九十\d]*[:：]?$/.test(b)) return '<span class="rv">'+esc(b)+'</span>';
  if(refIsDocTitle(b)) return '<p class="rv-doc">'+esc(b)+'</p>';
  return '<p>'+refInline(b).replace(/\n/g,'<br>')+'</p>';
}
/* 把编号从正文里挑出来，单独排一列，读的时候一条一条对 */
const REF_ITEM_RE=/^(\d{1,2}[.、．]|[一二三四五六七八九十]{1,2}、|[（(]\d{1,2}[）)])\s*/;
function refAnswerHTML(t,opts){
  const body=refSplitBody(t).body;
  if(!body.length) return '<p>'+refInline(refClean(t))+'</p>';
  if(opts&&opts.essay) return refEssayHTML(body);
  const items=[];
  body.forEach(bk=>{
    const seg=refClean(bk).replace(/([。；!？])\s*(?=(?:\d{1,2}[.、．]|[一二三四五六七八九十]{1,2}、|[（(]\d{1,2}[）)]))/g,'$1\u0001')
      .split('\u0001').map(x=>x.trim()).filter(Boolean);
    if(seg.length>1&&seg.every(x=>REF_ITEM_RE.test(x))){
      seg.forEach(x=>{const m=x.match(REF_ITEM_RE);items.push({k:m[0].trim(),v:x.slice(m[0].length)})});
    }else if(seg.length===1&&REF_ITEM_RE.test(seg[0])&&bk.length>60){
      const m=seg[0].match(REF_ITEM_RE);items.push({k:m[0].trim(),v:seg[0].slice(m[0].length)});
    }else{
      items.push({raw:bk});
    }
  });
  if(items.filter(x=>x.k).length>=2){
    return '<ol class="ref-ol">'+items.map(x=>x.raw!==undefined
      ? '<li class="ref-li-plain">'+refInline(x.raw).replace(/\n/g,'<br>')+'</li>'
      : '<li><span class="ref-li-k">'+esc(x.k)+'</span><span class="ref-li-v">'+refInline(x.v)+'</span></li>').join('')+'</ol>';
  }
  return items.map(x=>refBlockHTML(x.raw!==undefined?x.raw:(x.k+x.v))).join('');
}
/* 大作文范文：首段若像标题就单独排 */
function refEssayHTML(paras){
  let out='',list=paras.slice();
  if(list.length&&list[0].length<=32&&!/[。！？；]/.test(list[0])) out+='<p class="ref-title">'+esc(list.shift())+'</p>';
  out+=list.map(x=>'<p class="ref-para">'+refInline(x).replace(/\n/g,'<br>')+'</p>').join('');
  return out;
}
/* 复制时只给真实答案正文，不带说明 */
function refPlain(t){
  const sp=refSplitBody(t);
  return sp.body.join('\n\n').replace(/^(参考答案|参考范文|范文)[一二三四五六七八九十\d]*[:：]?$/gm,'').trim();
}
/* 说明区排版：范文点评按「标题 / 开头 / 论述段N / 结尾」分段列点，
   参考答案说明按（1）（2）或整段拆条，都去掉外层的【】和「参考答案说明：」前缀 */
function refNoteItems(txt){
  const items=[];
  txt.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).forEach(seg=>{
    if(/^【[^】]*】$/.test(seg)){items.push(seg.replace(/^【|】$/g,''));return}
    const parts=seg.split('\n').map(x=>x.trim()).filter(Boolean);
    if(parts.length>1){parts.forEach(p=>items.push(p.replace(/^【/,'').replace(/】$/,'')));return}
    const m=seg.match(/[（(]\d{1,2}[）)][^（(]*/g);
    if(m&&m.length>1&&!/^(来源)/.test(seg)&&!/[★【]/.test(seg)) m.forEach(x=>items.push(x.trim()));
    else items.push(seg);
  });
  return items.map(x=>x.replace(/^【/,'').replace(/】$/,'').replace(REF_NOTE_HEAD,'').trim()).filter(Boolean);
}
function refNoteHTML(note,kind){
  if(!note||!note.length) return '';
  const items=refNoteItems(note.join('\n\n'));
  if(!items.length) return '';
  const body=items.length>1
    ? '<ul>'+items.map(x=>'<li>'+refInline(x)+'</li>').join('')+'</ul>'
    : '<p>'+refInline(items[0])+'</p>';
  const fx=kind==='fenxi';
  const isX=kind==='x';
  /* 长说明默认收起，先把答案露出来；短说明直接摊开，不用多点一下 */
  const len=items.join('').length;
  const open=!fx&&len<=260;
  return '<details class="ref-note-block'+(fx?' ref-note-fx':'')+'"'+(open?' open':'')+'>'
    +'<summary><span class="ref-note-tag">'+(fx?'解析 · 范文点评':isX?'题库解析':'参考答案说明')+'</span>'
    +'<span class="ref-note-sub">'+(fx?'评卷思路，不是答案正文':'评分思路，不是答案正文')+'</span>'
    +'<span class="ref-note-chev" aria-hidden="true"></span></summary>'
    +'<div class="ref-note-body">'+body+'</div></details>';
}
function wsRefRender(a){
  const exam=WS.exam,q=exam.q[WS.qIdx],i=WS.qIdx,body=$('#ref-body');
  if(!body) return;
  const type=GRADE.qType(q);
  const typeName=GRADE.TYPE_NAME[type]||'';
  const max=GRADE.inferMax(q,type)||q.sc||0;
  if(!a){
    const links=Object.keys(REF_SRC).map(k=>'<a href="'+esc(REF_SRC[k].repo)+'" target="_blank" rel="noopener">'+esc(REF_SRC[k].name)+'</a>').join('');
    body.innerHTML='<div class="ref-empty"><b>这道题暂时没有参考答案</b>在 4 个公开题库里都没有找到对得上的答案，所以没有硬凑一份。<br>可以先提交批改，看要点、结构和表达上的问题。'
      +'<div class="ref-links">'+links+'</div></div>';
    return;
  }
  /* 要点只在答案正文里找：说明 / 范文点评不参与要点拆解 */
  const pts=type==='zuowen'?REF_DIMS:refSplit(refSplitBody(a.a).body.join('\n\n'));
  const stored=wsRefGet(exam,i);
  let hits=stored&&Array.isArray(stored.hits)?stored.hits.slice():null;
  if(!hits){
    hits=[];
    if(type!=='zuowen'){
      const txt=wsAnswerText();
      pts.forEach((p,idx)=>{if(refCovered(p,txt))hits.push(idx)});
    }
    wsRefSet(exam,i,{seen:1,at:Date.now(),hits:hits.slice()});
  }else if(!stored.seen){
    wsRefSet(exam,i,{seen:1,at:Date.now(),hits:hits.slice()});
  }
  const tier=REF_TIER[a.tier]||['已匹配',''];
  /* 答案本身与解析字段里都可能夹着说明，两处都拆，合起来当说明区 */
  const splitA=refSplitBody(a.a||'');
  const splitX=refSplitBody(a.x||'');
  const essay=type==='zuowen';
  const split={body:splitA.body,
    note:splitA.note.concat(splitX.note),
    kind:splitA.kind||splitX.kind};
  const meta='<div class="ref-meta"><span>第 '+(WS.qIdx+1)+' 题</span><span>·</span><span>'+esc(typeName)+'</span>'
    +(max?'<span>·</span><span>'+max+' 分</span>':'')
    +'<span>·</span><span>来源 </span>'+refSourceHTML(a)+'</div>';
  const note='<div class="ref-note'+(a.tier==='high'?' tip':'')+'">'+esc(tier[1])+'。这是机构或考生整理的答案，不是官方标准答案。</div>';
  /* 答案正文：只放真实答案，按条排版 */
  const hasBody=split.body.length>0;
  const ansHTML=hasBody?'<section class="ref-section ref-main" id="ref-main">'
    +'<div class="ref-sec-h"><b>'+(essay?'参考范文':'参考答案')+'</b><span>机构 / 考生整理版，非官方答案</span></div>'
    +'<div class="ref-ans'+(essay?' ref-ans-essay':'')+'">'+refAnswerHTML(a.a,{essay:essay})+'</div></section>'
    :'<section class="ref-section ref-main" id="ref-main"><div class="ref-sec-h"><b>'
    +'这道题的题库原文只有思路说明</b><span>没有给出成稿答案</span></div></section>';
  /* 参考答案说明 / 范文点评：跟答案分开放，不混在正文里 */
  let noteHTML=refNoteHTML(split.note,split.kind);
  /* 原题库的解析字段（x）单独成块：考点与解析，避免跟答案说明混在一起 */
  if(splitX.note.length&&splitX.body.length===0&&split.note.length){
    noteHTML+=refNoteHTML(splitX.note,'x');
  }
  const kList=(a.k&&a.k!=='未知'&&a.k!=='无')?'<span class="pill">'+esc(a.k)+'</span>':'';
  const head='<div class="ref-top">'
    +'<div class="ref-topline"><span class="ref-tier '+(a.tier==='high'?'ok':a.tier==='mid'?'mid':'loose')+'">'+esc(tier[0])+'</span>'+kList
    +(pts.length?'<span class="pill">'+pts.length+' 条要点</span>':'')+'</div>'
    +meta+note+'</div>';
  const chk=(hasBody&&pts.length)?'<section class="ref-check"><div class="ref-check-head"><b>要点自检</b><span>写到 <em id="ref-hit">'+hits.length+'</em> / '+pts.length+' 条</span><span class="grow"></span><button class="ref-auto" id="ref-auto">重新比对</button></div>'
      +'<div class="ref-pts" id="ref-pts">'+pts.map((p,idx)=>{
        const on=hits.indexOf(idx)>=0;
        return '<label class="ref-pt'+(on?' hit':'')+'" data-idx="'+idx+'"><input type="checkbox" data-pt="'+idx+'"'+(on?' checked':'')+'><span class="ref-idx">'+(idx+1)+'</span><span>'+esc(p)+'</span></label>';
      }).join('')+'</div>'
      +'<div class="ref-score"><span>估分</span><b id="ref-est">0</b><span>/ '+max+' 分</span><div class="ref-meter"><i id="ref-meter" style="width:'+(pts.length?hits.length/pts.length*100:0)+'%"></i></div></div><p class="ref-tip">已按关键词自动勾了一遍，不准的地方自己改。</p></section>':'';
  const alts=(a.alts&&a.alts.length)?'<section class="ref-alts"><b>其他来源的答案（'+a.alts.length+'）</b>'+a.alts.map((x,k)=>{
      const sp=refSplitBody(x.a||'');
      const altBody=sp.body.length?refAnswerHTML(x.a):'';
      const altNote=sp.note.length?('<div class="ref-note-mini">'+esc(sp.note.join(' ').replace(/^(参考答案说明|答案说明|评分说明)[:：]\s*/,''))+'</div>'):'';
      return '<details><summary><span class="ref-alt-name">'+esc(x.label||((REF_SRC[x.src]||{}).name||x.src))+'</span>'+((REF_SRC[x.src]||{}).name&&x.label?'<span class="ref-alt-src">'+esc((REF_SRC[x.src]||{}).name)+'</span>':'')+'</summary>'
        +(altBody?'<div class="ref-ans">'+altBody+'</div>':'<p class="ref-alt-none">这份答案没有成稿，只有思路说明：</p>')
        +altNote+'</details>';
    }).join('')+'</section>':'';
  body.innerHTML=head+ansHTML+noteHTML+chk+alts
    +'<div class="ref-acts"><button class="mini-btn" id="ref-mine-btn">看我的作答</button><button class="mini-btn" id="ref-copy">复制答案</button></div>'
    +'<div class="ref-mine" id="ref-mine" hidden></div>';
  const mine=$('#ref-mine');
  if(mine) mine.textContent=wsAnswerText()||'（本题还没有作答）';
  const recalc=()=>{
    const now=[];
    $$('#ref-pts .ref-pt').forEach(el=>{
      const idx=+el.dataset.idx;
      const cb=el.querySelector('input');
      el.classList.toggle('hit',!!(cb&&cb.checked));
      if(cb&&cb.checked) now.push(idx);
    });
    const cur=wsRefGet(exam,i)||{};
    wsRefSet(exam,i,{seen:1,at:cur.at||Date.now(),hits:now});
    const s=refScoreText(q,now.length,pts.length);
    const h=$('#ref-hit'),e=$('#ref-est'),m=$('#ref-meter');
    if(h)h.textContent=now.length;
    if(e)e.textContent=s.est;
    if(m)m.style.width=(pts.length?now.length/pts.length*100:0)+'%';
    wsUpdateRefBtn();
  };
  $$('#ref-pts input[data-pt]').forEach(cb=>cb.addEventListener('change',recalc));
  const auto=$('#ref-auto');
  if(auto) auto.addEventListener('click',()=>{
    const txt=wsAnswerText();
    $$('#ref-pts input[data-pt]').forEach(cb=>{cb.checked=refCovered(pts[+cb.dataset.pt],txt)});
    recalc();
    toast('已重新比对');
  });
  const s0=refScoreText(q,hits.length,pts.length);
  const e0=$('#ref-est');if(e0)e0.textContent=s0.est;
  $('#ref-copy').addEventListener('click',()=>copy(refPlain(a.a)||a.a,'答案已复制'));
  $('#ref-mine-btn').addEventListener('click',()=>{mine.hidden=!mine.hidden;mine.textContent=wsAnswerText()||'（本题还没有作答）'});
  const c2=$('#ref-close2');if(c2)c2.addEventListener('click',wsRefClose);
  wsUpdateRefBtn();
}
function wsRefOpen(){
  if(!WS.exam) return;
  wsLoadAnswers().then(()=>{
    if(!WS.exam) return;
    const a=wsAnsAt(WS.exam,WS.qIdx);
    const open=()=>{
      const p=$('#ws-ref');
      if(!p) return;
      wsRefRender(a);
      p.hidden=false;
      requestAnimationFrame(()=>p.classList.add('show'));
      const b=$('#ref-body');if(b)b.scrollTop=0;
    };
    if(!a){open();return}
    const seen=wsRefGet(WS.exam,WS.qIdx);
    if(seen&&seen.seen){open();return}
    const wrote=GRADE.cc(wsAnswerText())>=20;
    const graded=!!wsGradeGet(WS.exam,WS.qIdx);
    if(!wrote){
      appConfirm('这道题还没作答。先自己写一遍再对答案，效果更好。现在就看吗？',open,'现在看');
    }else if(!graded){
      open();
    }else{
      open();
    }
  });
}
function wsRefClose(){
  const p=$('#ws-ref');if(!p||p.hidden)return;
  p.classList.remove('show');setTimeout(()=>{p.hidden=true},220);
  wsUpdateRefBtn();
}
$('#ws-ref-btn').addEventListener('click',wsRefOpen);
$('#ref-close').addEventListener('click',wsRefClose);
$('#ws-ref .ref-mask').addEventListener('click',wsRefClose);

  $('#ws-page-prev').addEventListener('click',()=>wsGoPage(-1));
  $('#ws-page-next').addEventListener('click',()=>wsGoPage(1));
  let wsSnapT=null;
  const wsMatBox=$('#ws-material');
  wsMatBox.addEventListener('scroll',()=>{if(wsNarrow())return;wsUpdatePage();if(WS.animming)return;clearTimeout(wsSnapT);wsSnapT=setTimeout(()=>wsSnapTo(wsPages().now-1,false),260)});
  let wsAcc=0,wsAccT=null;
  wsMatBox.addEventListener('wheel',e=>{
    if(wsNarrow())return;
    e.preventDefault();
    let d=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=wsMatBox.clientHeight||600;
    clearTimeout(wsAccT);wsAccT=setTimeout(()=>{wsAcc=0},200);
    if(WS.animming){const a=WS.anim;const t=a?Math.min(1,(performance.now()-a.t0)/a.dur):1;if(t<0.55){wsAcc=0;return}}
    wsAcc+=d;
    if(Math.abs(wsAcc)>=48){const dir=wsAcc>0?1:-1;wsAcc=0;wsGoPage(dir)}
  },{passive:false});
  document.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    if(!$('#view-workspace').classList.contains('active')||wsNarrow())return;
    if(!$('#ws-grade').hidden||!$('#ws-picker').hidden)return;
    const ac=document.getElementById('app-confirm');if(ac&&!ac.hidden)return;
    const t=e.target;if(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.tagName==='SELECT'||t.isContentEditable))return;
    wsGoPage(e.key==='ArrowRight'?1:-1);
  });
  function wsPreservePage(fn){wsCancelAnim();const box=$('#ws-material');const now=wsPages().now;fn();wsLayoutColumns();if(box){box.scrollLeft=(now-1)*(WS.step||1);wsUpdatePage()}}
  if(window.ResizeObserver){new ResizeObserver(()=>{wsPreservePage(()=>{})}).observe(wsMatBox)}
  else window.addEventListener('resize',()=>wsPreservePage(()=>{}));
  function wsMatTabs(){
    $('#ws-mat-tabs').innerHTML=WS.exam.m.map((m,i)=>`<button class="${i===WS.matIdx?'active':''}" data-mat="${i}">资料 ${i+1}</button>`).join('');
    $$('#ws-mat-tabs button').forEach(b=>b.addEventListener('click',()=>{WS.matIdx=+b.dataset.mat;wsRenderMaterial();wsMatTabs();const mb=$('#ws-material');if(mb)mb.scrollLeft=0;const ab=$('#ws-mat-tabs button.active');if(ab&&ab.scrollIntoView)ab.scrollIntoView({block:'nearest',inline:'center'});wsPaneTop()}));
  }
  function wsCount(){
    if(!WS.exam)return;
    const n=wsAnswerText().replace(/\s/g,'').length;
    const el=$('#ws-count');
    const li=wsLimitInfo(WS.exam.q[WS.qIdx]);
    const max=li.max,min=li.min;
    if(el){
      el.textContent=n+(max?' / '+max+' 字':min?' 字 · 至少 '+min:' 字');
      el.className='ws-count'+((max&&n>max)||(min&&n<min)?' over':'')+((max&&n<max*0.5)?' short':'');
    }
    const tip=$('#ws-grid-tip');
    if(!tip)return;
    /* 提示只在状态变化时改字，别每敲一个字都重刷一遍（看起来像一直冒提示） */
    let t;
    if(max&&n>max)t='超出 '+(n-max)+' 字，超出部分不计分';
    else if(min&&n<min)t='离字数下限还差 '+(min-n)+' 字';
    else t='';
    if(tip.textContent!==t)tip.textContent=t;
  }
  function wsTabBadges(){
    const btns=$$('#ws-q-tabs button');
    WS.exam.q.forEach((x,i)=>{
      const b=btns[i];if(!b)return;
      const n=wsAnsGet(WS.exam,i),g=wsGradeGet(WS.exam,i);
      const wc=g&&g.final!=null?g.final+' 分':(n&&n.replace(/\s/g,'').length?n.replace(/\s/g,'').length+' 字':'');
      let sp=b.querySelector('.mini');
      if(!wc){if(sp)sp.parentNode.removeChild(sp);return}
      if(!sp){sp=document.createElement('span');b.appendChild(sp)}
      sp.className='mini'+(g?' gr':'');
      sp.textContent=wc;
    });
  }
  function wsRenderQuestion(){
    const q=WS.exam.q[WS.qIdx];
    $('#ws-q-tabs').innerHTML=WS.exam.q.map((x,i)=>`<button class="${i===WS.qIdx?'active':''}" data-q="${i}">第 ${i+1} 题</button>`).join('');
    wsTabBadges();
    $$('#ws-q-tabs button').forEach(b=>b.addEventListener('click',()=>{
      if(+b.dataset.q===WS.qIdx)return;
      wsFlushSave();WS.qIdx=+b.dataset.q;wsRenderQuestion();wsLoadAnswer();wsShowSavedReport();wsCount();wsUpdateRefBtn();
      const ab=$('#ws-q-tabs button.active');if(ab&&ab.scrollIntoView)ab.scrollIntoView({block:'nearest',inline:'center'});
    }));
    let html='<h3>'+esc(q.t)+'</h3><div class="ws-score">';
    const scMax=(window.GRADE?GRADE.inferMax(q,GRADE.qType(q)):(q.sc||0));
    if(scMax) html+='<span class="pill"'+(q.sc?'':' title="原题没有标分值，这是按题型推断的满分"')+'>'+scMax+' 分</span>';
    const li=wsLimitInfo(q);
    if(li.max) html+='<span class="pill">'+(li.min?li.min+'–':'不超过 ')+li.max+' 字</span>';
    else if(li.min) html+='<span class="pill">不少于 '+li.min+' 字</span>';
    html+='<span id="ws-ref-state"></span>';
    html+='</div>';
    if(q.rq) html+='<div class="ws-req"><b>要求　</b>'+esc(q.rq)+'</div>';
    $('#ws-question').innerHTML=html;
    wsRenderPeek();
    wsUpdateRefBtn();
  }
  /* 方格纸：每格一字，点格落笔，自动保存 */
  let WGRID=null;
  function wsGridEnsure(){
    if(WGRID) return WGRID;
    WGRID=KL.Grid({el:'#ws-grid-host',perRow:20,rows:8,indent:2,limit:0,onChange:()=>{ if(WS.exam) wsCount() }});
    return WGRID;
  }
  function wsAnswerText(){
    return WGRID?WGRID.getValue():'';
  }
  function wsLoadAnswer(){
    clearTimeout(WS.saveT);WS.saveT=null;
    const q=WS.exam.q[WS.qIdx];
    const v=wsAnsGet(WS.exam,WS.qIdx);
    const g=wsGridEnsure();
    WS.loadingAns=true;
    if(g){ g.setLimit(wsLimitInfo(q).max); g.setValue(v,{scroll:false}); }
    WS.loadingAns=false;
    wsCount();
    $('#ws-save-status').textContent=v?'已恢复上次的作答':'自动保存';
  }
  function wsFlushSave(){
    if(!WS.exam) return;
    wsAnsSet(WS.exam,WS.qIdx,wsAnswerText());
  }
  function wsRenderMeta(){
    const e=WS.exam;
    const annN=KL.countOps(wsGetAnn().ops);
    $('#ws-meta').innerHTML=`<span>材料 ${e.m.length} 份</span><span>${e.c>=10000?(e.c/10000).toFixed(1)+' 万字':e.c+' 字'}</span><span>${e.q.length} 题</span><span id="ws-ann-total">标注 ${annN} 处</span>`;
  }
  function wsFillSelect(){
    const idx=window.SH_EXAM_INDEX||[];
    const groups={};
    idx.forEach(x=>{ (groups[x.r==='国考'?'国家公务员考试':x.r]=groups[x.r==='国考'?'国家公务员考试':x.r]||[]).push(x) });
    let html='';
    Object.keys(groups).sort((a,b)=>a==='国家公务员考试'?-1:b==='国家公务员考试'?1:a.localeCompare(b,'zh')).forEach(r=>{
      html+=`<optgroup label="${esc(r)}">`+groups[r].sort((a,b)=>b.y-a.y).map(x=>`<option value="${esc(x.id)}">${esc(x.r)} ${x.y}${x.l?' · '+esc(x.l):''}（${wsQCount(x)} 题 / ${(x.c/10000).toFixed(1)}万字）</option>`).join('')+'</optgroup>';
    });
    $('#ws-exam').innerHTML=html;
  }
  async function renderWorkspace(){
    const grid=$('#ws-grid'),empty=$('#ws-empty');
    if(!window.SH_EXAM_INDEX){
      empty.hidden=false;grid.hidden=true;empty.textContent='真题目录没有加载出来，刷新页面试试。';
      return;
    }
    if(!window.SH_EXAMS){ empty.hidden=false;grid.hidden=true;empty.textContent='正在加载真题…'; }
    if(!$('#ws-exam').options.length) wsFillSelect();
    if(!WS.exam){
      const lastId=LS.getItem('sh_ws_last');
      const meta=(window.SH_EXAM_INDEX||[]).find(x=>x.id===lastId);
      const cand=meta?meta.id:(window.SH_EXAM_INDEX[0]||{}).id;
      if(!cand){empty.hidden=false;grid.hidden=true;empty.textContent='真题目录是空的。';return}
      await wsLoadGroup(meta?meta.grp:'gk');
      const ex=wsGetExam(cand);
      if(!ex){empty.hidden=false;grid.hidden=true;empty.textContent='这套卷子没有加载出来，刷新页面试试。';return}
      wsSetExam(ex);
    }
    empty.hidden=true;grid.hidden=false;
    wsLayoutColumns();wsUpdatePage();wsSyncFloat();
    if(state.view==='dashboard')renderDashboard();
  }
  function wsSetExam(ex){
    /* 切卷前先把当前题的作答写盘，否则刚写的内容会随状态切换丢失 */
    if(WS.exam&&WS.exam.id!==ex.id) wsFlushSave();
    const rp=$('#ws-ref');if(rp&&!rp.hidden) wsRefClose();
    clearTimeout(WS.saveT);clearTimeout(WS.gradingT);WS.grading=false;
    WS.exam=ex;WS.matIdx=0;WS.qIdx=0;WS.ann=null;WS.undoOps=null;
    if(WSANN)WSANN.reset();
    const ub=$('#ws-undo-mat');if(ub)ub.hidden=true;
    LS.setItem('sh_ws_last',ex.id);
    $('#ws-exam').value=ex.id;wsUpdatePickBtn();wsRefreshSelectLabel(ex);
    wsRenderMeta();wsMatTabs();wsRenderBrushes();wsRenderMaterial();wsRenderQuestion();wsLoadAnswer();wsTimerShow();
    const mb=$('#ws-material');if(mb){mb.scrollLeft=0;wsUpdatePage()}
    wsModalClose();const gp=$('#ws-grade .grm-body');if(gp)gp.innerHTML='';
    wsShowSavedReport();
    /* 参考答案按组懒加载：切卷后后台预取，打开面板时不再等待 */
    wsUpdateRefBtn();
    wsLoadAnswers().then(()=>{wsUpdateRefBtn();wsTabBadges()});
  }
  $('#ws-exam').addEventListener('change',async e=>{
    const id=e.target.value;
    const grp=(window.SH_EXAM_INDEX.find(x=>x.id===id)||{}).grp||'gk';
    await wsLoadGroup(grp);
    const ex=wsGetExam(id);
    if(ex){wsSetExam(ex)}
  });
  /* ---------- 标注：统一走 KL 公用引擎 ---------- */
  WSANN=KL.Annotator({
    el:'#ws-material',
    brush:'y',
    matIdx:()=>WS.matIdx,
    getMats:()=>WS.exam?WS.exam.m:[],
    key:m=>'sh_ws_'+(WS.exam?WS.exam.id:'x')+'_hl',
    countEl:'#ws-hl-count',
    onAfter:()=>{ wsSyncFloat(); wsSyncAnnPill(); },
    onBrush:b=>{ WS.brush=b; wsSyncFloat(); }
  });
  const ANN=WSANN;
  function wsRenderBrushes(){
    const bar=$('#ws-brushes');
    if(bar) bar.innerHTML=KL.brushBarHTML(WS.brush);
    const now=$('#ws-ann-now');
    if(now) now.innerHTML=wsBrushNow();
    wsSyncFloat();
  }
  /* 顶栏“标注 N 处”要跟着画笔实时更新，别只在保存作答时刷新 */
  function wsSyncAnnPill(){
    const pill=$('#ws-ann-total');
    if(pill&&WS.exam) pill.textContent='标注 '+KL.countOps(wsGetAnn().ops)+' 处';
  }
  function wsSyncFloat(){
    const f=$('#kk-float');
    if(!f) return;
    const view=document.getElementById('view-workspace');
    const on=view&&view.classList.contains('active')&&!$('#ws-grid').hidden&&$('#ws-grid').dataset.pane!=='ans';
    if(!on||!wsNarrow()){ if(f.dataset.ctx==='ws'||!f.dataset.ctx){ f.hidden=true; f.innerHTML=''; f.dataset.ctx=''; } return; }
    f.hidden=false; f.dataset.ctx='ws';
    f.classList.toggle('mini',!!WS.floatOff);
    f.innerHTML=WS.floatOff
      ?'<button class="kk-float-x" data-float="open" aria-label="展开标注笔">'+ico('pen')+'</button>'
      :KL.brushBarHTML(WS.brush)+'<button class="kk-float-x" data-float="close" aria-label="收起标注笔">'+ico('right')+'</button>';
  }
  /* 手机上「材料 / 作答」分两页：各占满屏宽，互不挤压 */
  function wsPaneTop(){
    if(!wsNarrow())return;
    const strip=$('.ws-strip');if(!strip)return;
    const y=$('#ws-grid').getBoundingClientRect().top+window.scrollY-strip.offsetHeight-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'))||52);
    if(window.scrollY>y)window.scrollTo(0,Math.max(0,y));
  }
  function wsSetPane(pane,keep){
    const g=$('#ws-grid');if(!g)return;
    g.dataset.pane=pane;
    $$('#ws-switch button').forEach(b=>{const on=b.dataset.pane===pane;b.classList.toggle('active',on);b.setAttribute('aria-selected',on)});
    if(pane==='ans'&&WGRID&&WGRID.render)try{WGRID.render()}catch(e){}
    wsSyncFloat();
    if(!keep)wsPaneTop();
  }
  $$('#ws-switch button').forEach(b=>b.addEventListener('click',()=>wsSetPane(b.dataset.pane)));
  /* 读材料时把当前题目钉在上面：点一下展开全文，再点「去作答」 */
  function wsRenderPeek(){
    const el=$('#ws-qpeek');if(!el||!WS.exam)return;
    const q=WS.exam.q[WS.qIdx];if(!q){el.innerHTML='';return}
    el.setAttribute('aria-expanded','false');
    el.innerHTML='<span class="qp-text"><b>第 '+(WS.qIdx+1)+' 题</b>'+esc(q.t)+(q.rq?'　要求：'+esc(q.rq):'')+'</span><span class="qp-go" data-qp-go>去作答'+ico('right')+'</span>';
  }
  $('#ws-qpeek').addEventListener('click',e=>{
    const el=$('#ws-qpeek');
    if(e.target.closest('[data-qp-go]')){wsSetPane('ans');return}
    el.setAttribute('aria-expanded',el.getAttribute('aria-expanded')==='true'?'false':'true');
  });
  window.SH_WSRELAYOUT=function(){try{if(WS.exam&&$('#view-workspace').classList.contains('active')){wsLayoutColumns();wsUpdatePage()}}catch(e){}};
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-brush]');
    if(!b) return;
    if(!$('#view-workspace')||!$('#view-workspace').classList.contains('active')) return;
    WS.brush=b.dataset.brush;
    ANN.setBrush(WS.brush);
    wsRenderBrushes();

  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-float]');
    if(!b||!$('#view-workspace').classList.contains('active')) return;
    WS.floatOff=b.dataset.float==='close';wsSyncFloat();
  });
  function wsClearMat(){
    if(!WS.exam) return;
    const ann=wsGetAnn();
    const mine=ann.ops.filter(o=>o.m===WS.matIdx);
    const n=KL.countOps(mine,WS.matIdx);
    if(!n){toast('这份资料还没有标注');return}
    WS.undoOps=mine;
    ann.ops=ann.ops.filter(o=>o.m!==WS.matIdx);
    wsSaveAnn();wsRenderMaterial();wsMatTabs();wsRenderMeta();
    const ub=$('#ws-undo-mat'); if(ub) ub.hidden=false;
    toast('已清空 '+n+' 处标注，可以撤销');
  }
  $('#ws-clear-mat').addEventListener('click',wsClearMat);
  $('#ws-undo-mat').addEventListener('click',()=>{
    if(!WS.exam||!WS.undoOps){$('#ws-undo-mat').hidden=true;return}
    wsGetAnn().ops.push.apply(wsGetAnn().ops,WS.undoOps);
    wsSaveAnn();wsRenderMaterial();wsMatTabs();wsRenderMeta();
    WS.undoOps=null;$('#ws-undo-mat').hidden=true;
    toast('已恢复标注');
  });
  /* answer input：方格纸的每次真实输入都会派发 kk:gridinput，600ms 后落盘 */
  function wsAnsChanged(){
    if(!WS.exam||WS.loadingAns) return;
    wsCount();
    clearTimeout(WS.saveT);
    WS.saveT=setTimeout(()=>{
      wsFlushSave();wsRenderMeta();wsTabBadges();
      $('#ws-save-status').textContent='已保存 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
    },600);
  }
  document.addEventListener('kk:gridinput',e=>{ if(e.detail&&e.detail.id==='ws-grid-host') wsAnsChanged() });
  /* 离开页面 / 切到后台时立刻落盘 */
  window.addEventListener('beforeunload',()=>{try{wsFlushSave()}catch(e){}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){try{wsFlushSave()}catch(e){}}});
  $('#ws-copy-ans').addEventListener('click',()=>{if(!wsAnswerText()){toast('这道题还没有作答');return}copy(wsAnswerText(),'作答已复制')});
  $('#ws-clear-ans').addEventListener('click',()=>{
    if(!wsAnswerText()){toast('这道题还没有作答');return}
    appConfirm('清空这道题的作答？清空后无法恢复。',()=>{
      const g=wsGridEnsure(); if(g) g.setValue('');
      wsFlushSave();wsCount();wsRenderMeta();wsTabBadges();
      $('#ws-save-status').textContent='已清空';
    },'清空');
  });
  /* timer */
  function wsTimerShow(){
    const t=JSON.parse(LS.getItem('sh_ws_timer')||'{}');
    const secs=t[WS.exam?WS.exam.id:'_']||10800;
    const h=Math.floor(secs/3600),m=String(Math.floor(secs%3600/60)).padStart(2,'0'),s=String(secs%60).padStart(2,'0');
    $('#ws-clock').textContent=h+':'+m+':'+s;
    $('#ws-timer-toggle').textContent=WS.timer?'暂停':(secs<10800?'继续':'开始');
    $('#ws-timer-reset').hidden=secs>=10800&&!WS.timer;
    $('#ws-timer').classList.toggle('running',!!WS.timer);
    $('#ws-timer').classList.toggle('low',secs<=600);   // 最后 10 分钟才变红
  }
  function wsStopTimer(){ clearInterval(WS.timer);WS.timer=null;wsTimerShow() }
  $('#ws-timer-toggle').addEventListener('click',()=>{
    if(WS.timer){ wsStopTimer();return }
    if(!WS.exam){toast('先选一套真题');return}
    const id=WS.exam.id;               // 绑定当前试卷，切换试卷不会扣另一套卷的时间
    WS.timer=setInterval(()=>{
      if(!WS.exam||WS.exam.id!==id){wsStopTimer();return}
      const t=JSON.parse(LS.getItem('sh_ws_timer')||'{}');
      t[id]=Math.max(0,(t[id]||10800)-1);
      LS.setItem('sh_ws_timer',JSON.stringify(t));
      wsTimerShow();
      if(!t[id]){wsStopTimer();toast('时间到')}
    },1000);
    wsTimerShow();
  });
  $('#ws-timer-reset').addEventListener('click',()=>{
    appConfirm('把计时重置回 3 小时？',()=>{
      const t=JSON.parse(LS.getItem('sh_ws_timer')||'{}');
      t[WS.exam?WS.exam.id:'_']=10800;
      LS.setItem('sh_ws_timer',JSON.stringify(t));
      wsStopTimer();
    },'重置');
  });

  /* ---------- 启动 ---------- */
 applyTheme();applyPrefs();
 renderDashboard();renderVocab();renderStrategy();renderCases();renderFormat();renderReview();renderSettings();
 (function(){const h=(location.hash||'').slice(1);if(viewNames[h]&&h!=='dashboard'){openView(h,{fromHistory:true});pushView(h,true)}else{document.body.dataset.view='dashboard';pushView('dashboard',true)}})();
 window.openView=openView;window.SH_RENDERALL=renderAll;window.SH_CONFIRM=appConfirm;window.SH_TOAST=toast;
 window.SH_WSFLOAT=function(){try{return wsSyncFloat()}catch(e){}};
 window.addEventListener('resize',function(){if(window.SH_WSFLOAT)window.SH_WSFLOAT()});
 window.addEventListener('orientationchange',function(){setTimeout(function(){if(window.SH_WSFLOAT)window.SH_WSFLOAT()},260)});
})();
