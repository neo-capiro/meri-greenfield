/** Private typed recipe input. Public WordRequest/routes remain unchanged. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveCongressionalBillId} from '../../../../packages/contracts/retrieval-0.2/congressional-identity.mjs';
export const fail = code => {throw Object.assign(new Error(code),{code});};
export const text = (value,max=4000) => {
  if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail('BRIEF_INPUT');
  return value;
};
export const hash = value => /^[a-f0-9]{64}$/u.test(value??'');
export function subject(value){
  const s=own(v.snapshot(value),['congress','session','billId','billVersion','fiscalYear','budgetStage']);
  if(!Number.isInteger(s.congress)||s.congress<1||s.congress>999||![1,2].includes(s.session)||
    !Number.isInteger(s.fiscalYear)||s.fiscalYear<1900||s.fiscalYear>9999||
    resolveCongressionalBillId(text(s.billId,60),s.congress)!==s.billId||!s.billId.startsWith(s.congress+'-')||
    !/^[a-z][a-z0-9_.-]{0,31}$/u.test(text(s.billVersion,32))||
    !['requested','authorized','appropriated','obligated','actual','outlay'].includes(s.budgetStage))fail('BRIEF_SUBJECT');
  return s;
}
export function briefInput(value,pin){
  const i=own(v.snapshot(value),['skill','title','subject','asOf','facts','proposedLanguage']);
  own(i.skill,Object.keys(pin));if(v.hash(i.skill)!==v.hash(pin))fail('BRIEF_SKILL_PIN');
  text(i.title,200);i.subject=subject(i.subject);
  if(typeof i.asOf!=='string'||new Date(Date.parse(i.asOf)).toISOString()!==i.asOf)fail('BRIEF_AS_OF');
  if(!Array.isArray(i.facts)||i.facts.length<1||i.facts.length>40||!Array.isArray(i.proposedLanguage)||i.proposedLanguage.length<1||i.proposedLanguage.length>20)fail('BRIEF_INPUT');
  const ids=new Set();
  for(const f of i.facts){
    own(f,['id','kind','text','citations']);text(f.id,64);text(f.text,2000);
    if(ids.has(f.id)||!['excerpt','claim'].includes(f.kind)||!Array.isArray(f.citations)||f.citations.length>10)fail('BRIEF_INPUT');ids.add(f.id);
    for(const c of f.citations){
      own(c,['sourceId','recordId','sourceVersionId','start','end'],['url']);
      for(const field of ['sourceId','recordId','sourceVersionId'])text(c[field],256);
      if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<=c.start)fail('BRIEF_CITATION');
      if(c.url!==undefined){text(c.url,1000);const u=new URL(c.url);if(u.protocol!=='https:'||u.username||u.password)fail('BRIEF_CITATION');}
    }
    if(f.kind==='excerpt'&&f.citations.length!==1)fail('BRIEF_CITATION');
  }
  i.proposedLanguage.forEach(x=>text(x,4000));return i;
}
