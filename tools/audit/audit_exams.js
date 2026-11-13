/* 真题数据一致性审计：题干引用的资料是否存在、题干引文是否落在所指资料里、材料主题是否对得上 */
const fs=require('fs'),vm=require('vm');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['index','gk','prov1','prov2']) vm.runInContext(fs.readFileSync('exams/'+f+'.js','utf8'),ctx);
const E=ctx.window.SH_EXAMS, IDX=ctx.window.SH_EXAM_INDEX;

const norm=s=>String(s||'').replace(/[\s\u3000]/g,'')
  .replace(/[（）、，,。.；;：:！!？?“”"'‘’【】\[\]《》<>—\-~·…]/g,'');
const CN='一二三四五六七八九十';
function cn2num(s){if(/^\d+$/.test(s))return +s;if(s==='十')return 10;
  let n=0;const i=s.indexOf('十');
  if(i<0){for(const c of s)n=n*10+CN.indexOf(c)+1;return n}
  const a=i>0?CN.indexOf(s[0])+1:1,b=i<s.length-1?CN.indexOf(s[s.length-1])+1:0;return a*10+b}

const out=[];
E.forEach(e=>{
  const mats=e.m.map(m=>norm(m.p.join('')));
  const all=mats.join('');
  e.q.forEach((q,i)=>{
    const t=String(q.t||'');
    /* 1. 引用资料号：给定资料1 / 材料4-6 / 【材料7】/ 资料7、8、9 */
    const refs=[];
    const re=/(?:给定)?(?:资料|材料)\s*([0-9]+|[一二三四五六七八九十]+)(?:\s*[-－—~～至到]\s*([0-9]+|[一二三四五六七八九十]+))?/g;
    let m;
    while((m=re.exec(t))){
      const a=cn2num(m[1]), b=m[2]?cn2num(m[2]):a;
      for(let k=Math.min(a,b);k<=Math.max(a,b);k++) refs.push(k);
    }
    const rr=[...new Set(refs)];
    const oor=rr.filter(k=>k<1||k>e.m.length);
    /* 2. 题干引文核对：题干里引号内的长句应能在所指资料里找到 */
    const quotes=(t.match(/[“"]([^”"]{12,})[”"]/g)||[]).map(x=>x.slice(1,-1));
    const qMiss=[],qElsewhere=[];
    quotes.forEach(qq=>{
      const nq=norm(qq);
      const inRef=rr.length?rr.some(k=>mats[k-1]&&mats[k-1].indexOf(nq)>=0):all.indexOf(nq)>=0;
      if(inRef) return;
      const inWhole=all.indexOf(nq)>=0;
      (inWhole?qElsewhere:qMiss).push(qq.slice(0,40));
    });
    /* 3. 主题分：题干与各资料的二元组重合，看所指资料是否主题吻合 */
    const bg=s=>{const o=new Set();for(let i=0;i<s.length-1;i++)o.add(s.slice(i,i+2));return o};
    const qb=bg(norm(t).replace(/\d+/g,''));
    const sc=mats.map(mt=>{const mb=bg(mt.replace(/\d+/g,''));let h=0;qb.forEach(x=>{if(mb.has(x))h++});return qb.size?h/qb.size:0});
    const cited=rr.map(k=>sc[k-1]||0);
    const best=Math.max.apply(null,sc.concat([0]));
    const citedMax=cited.length?Math.max.apply(null,cited):0;
    const offTopic=(rr.length&&best>0.30&&citedMax<best*0.45);
    if(oor.length||qMiss.length||qElsewhere.length||offTopic)
      out.push({id:e.id,qi:i+1,t:t.slice(0,70),mats:e.m.length,refs:rr,oor,qMiss,qElsewhere,
        citedMax:+citedMax.toFixed(2),best:+best.toFixed(2),offTopic,
        /* 上游源卷本身残缺：题干引了资料8 但源文件只有 7 份材料。
           这不是我们处理错了，数据层无法凭空补出第 8 份材料，单独标出来，别和真错位混在一起。 */
        srcGap:oor.length>0&&rr.every(k=>k>e.m.length)});
  });
});
const hard=out.filter(x=>!x.srcGap);
console.log(JSON.stringify({total:out.length,hard:hard.length,items:out},null,1));
