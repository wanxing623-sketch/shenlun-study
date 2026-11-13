#!/usr/bin/env node
/* 参考答案与题目的一致性审计：
 *  1. 每套卷是否都有答案数组、长度是否等于题数
 *  2. 答案是否挂到题干确实是同一道题（题干相似度高）→ 防串题
 *  3. a 字段里是否还残留「参考答案说明 / 解析 / 考点 / 来源」
 *  4. note / x / k / alts 是否用到、来源链接是否可拼
 * 用法：node tools/audit/audit_answers.js [--json]
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ['exams/index.js', 'exams/gk.js', 'exams/prov1.js', 'exams/prov2.js',
                 'exams/answers-gk.js', 'exams/answers-prov1.js', 'exams/answers-prov2.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx);
}
const E = ctx.window.SH_EXAMS || [], A = ctx.window.SH_ANSWERS || {};
const norm = s => String(s || '').replace(/[\s，。；：、！？“”‘’（）《》〈〉【】·—…,.:;!?()\[\]"'\-_/\\|*#`]/g, '');
function big(s){const o=new Set();for(let i=0;i<s.length-1;i++)o.add(s.slice(i,i+2));return o}
function sim(a,b){a=big(a);b=big(b);if(!a.size||!b.size)return 0;let h=0;a.forEach(x=>{if(b.has(x))h++});return 2*h/(a.size+b.size)}

const rows = [], problems = [];
let total = 0, covered = 0, noAnswer = [], lenBad = [], weak = [], dirty = [], noSrc = [], extra = [];
for (const e of E) {
  const arr = A[e.id];
  if (!arr) { noAnswer.push(e.id); continue; }
  if (arr.length !== e.q.length) lenBad.push([e.id, arr.length, e.q.length]);
  if (arr.filter(x => !x).length > e.q.length) lenBad.push([e.id + '(空位超题数)', arr.filter(x => !x).length, e.q.length]);
  arr.forEach((x, i) => {
    total++;
    const q = e.q[i] || {};
    if (!x) return;
    covered++;
    const s = sim(norm(q.t), norm(x.q || '')) || (x.tier === 'high' ? 1 : 0);
    // 数据里没存题干时，用答案正文与题干无直接可比性，跳过
    if (x.q && s < 0.62) weak.push([e.id, i + 1, +s.toFixed(2), String(q.t).slice(0, 30)]);
    const body = x.a || '';
    if (/参考答案说明\s*[：:]|^\s*(?:解析|考点|来源)\s*[：:]?\s*$|考点[：:]|来源[：:]/m.test(body)) dirty.push([e.id, i + 1]);
    /* 抓取附注 / 范文点评 / 失效链接：这些都不属于答案正文 */
    if (/来源说明[：:]|本题来源记录|依据同题证据|原记录卷型|字形等价处理|完整答案取自/.test(body)) extra.push([e.id, i + 1, '抓取附注']);
    if (/文章分析|范文分析|【[^】]{0,14}(的优点|的点评)】|论述段\d?\s*的优点|标题的优点|开头的优点|结尾的优点/.test(body)) extra.push([e.id, i + 1, '范文点评']);
    if (/https?:\/\/|\[[^\]]{1,20}\]\(http/.test(body)) extra.push([e.id, i + 1, '裸链接']);
    if (body.replace(/\s/g, '').length < 30) extra.push([e.id, i + 1, '正文过短']);
    if (/^[，,。；;、]/.test(body)) extra.push([e.id, i + 1, '残留尾巴']);
    if (!x.src || !x.path) noSrc.push([e.id, i + 1]);
  });
}
const out = {
  exams: E.length, answerKeys: Object.keys(A).length, questions: E.reduce((s, e) => s + e.q.length, 0),
  covered, rate: +(covered / Math.max(1, E.reduce((s, e) => s + e.q.length, 0)) * 100).toFixed(1),
  examsWithoutAnswers: noAnswer, lenMismatch: lenBad, weakMatch: weak.slice(0, 30),
  dirtyBody: dirty.slice(0, 30), missingSource: noSrc.slice(0, 10),
  junk: extra.slice(0, 30),
  flags: noAnswer.length + lenBad.length + weak.length + dirty.length + extra.length
};
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`卷 ${out.exams} / 题 ${out.questions} / 有答案 ${out.covered}（${out.rate}%）`);
  if (noAnswer.length) console.log('整卷无答案：', noAnswer.join('、'));
  if (lenBad.length) console.log('长度不符：', lenBad.map(x => x.join(':')).join('、'));
  if (dirty.length) console.log('答案正文残留说明/解析：', dirty.length, '处', JSON.stringify(dirty.slice(0, 5)));
  if (weak.length) console.log('题干对不上：', weak.length, '处', JSON.stringify(weak.slice(0, 5)));
  if (noSrc.length) console.log('缺来源：', noSrc.length, '处');
  if (extra.length) {
    const by = {};
    extra.forEach(x => { by[x[2]] = (by[x[2]] || 0) + 1 });
    console.log('正文杂质：', JSON.stringify(by), JSON.stringify(extra.slice(0, 5)));
  }
  console.log(out.flags ? `共 ${out.flags} 项待处理` : '一致性与结构检查通过');
}
