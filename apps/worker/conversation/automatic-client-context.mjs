/** Private Core projection carried by runtime preparation, never a public tool DTO or authority. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const AUTOMATIC_CONTEXT_MAX_BYTES=24576;
const ids=['identity','capabilities','objectives','constraints','people_and_footprint','commitments_and_corrections'];
const fail=()=>{throw Object.assign(Error('AUTOMATIC_CONTEXT_REFUSED'),{code:'AUTOMATIC_CONTEXT_REFUSED'});};
const text=(v,max=1600)=>typeof v==='string'&&v.length>0&&v.length<=max;
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const strings=(v,max=20)=>Array.isArray(v)&&v.length<=max&&v.every(x=>text(x));
export function assertAutomaticClientContext(value,{binding,selectedClientId,scopes}={}){
 if(value===null){if(selectedClientId!==undefined&&selectedClientId!==null)fail();return null;}
 const p=data(own(value,['schemaVersion','subject','readWindow','sections','limitations']));
 if(Buffer.byteLength(JSON.stringify(p),'utf8')>AUTOMATIC_CONTEXT_MAX_BYTES||p.schemaVersion!==1)fail();
 own(p.subject,['kind','tenantId','actorId','clientId']);own(p.readWindow,['startedAt','completedAt']);
 if(p.subject.kind!=='selected-client'||!binding||p.subject.tenantId!==binding.tenantId||p.subject.actorId!==binding.actorId||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(p.subject.clientId)||
   selectedClientId!==undefined&&p.subject.clientId!==selectedClientId||scopes!==undefined&&!scopes.some(s=>s.kind==='client'&&s.tenantId===binding.tenantId&&s.resourceId===p.subject.clientId)||
   !date(p.readWindow.startedAt)||!date(p.readWindow.completedAt)||p.readWindow.startedAt>p.readWindow.completedAt||!strings(p.limitations)||p.limitations.length===0||
   !Array.isArray(p.sections)||p.sections.length!==ids.length)fail();
 for(const [i,s] of p.sections.entries()){
  own(s,['id','label','facts','coverage','gaps']);
  if(s.id!==ids[i]||!text(s.label,160)||!strings(s.gaps)||!Array.isArray(s.facts)||s.facts.length>12||!Array.isArray(s.coverage)||s.coverage.length>4)fail();
  for(const f of s.facts){own(f,['source','recordId','version','updatedAt','values','omittedFields','projectionSha256']);
   if(!text(f.source,80)||!text(f.recordId,200)||f.version!==null&&!text(f.version,200)||f.updatedAt!==null&&!date(f.updatedAt)||!strings(f.omittedFields)||
    !/^[0-9a-f]{64}$/u.test(f.projectionSha256))fail();
   own(f.values,[],Object.keys(f.values));
   if(Object.keys(f.values).length>24||Object.values(f.values).some(v=>!(typeof v==='string'&&v.length<=1600||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.length<=16&&v.every(x=>text(x,160)))))fail();
   if(createHash('sha256').update(JSON.stringify(f.values)).digest('hex')!==f.projectionSha256)fail();
  }
  for(const c of s.coverage){own(c,['source','status','total','returned','selected']);
   if(!text(c.source,80)||!['complete','partial','unavailable','not_requested','recent_sample','healthy','degraded','unsupported','error'].includes(c.status)||
    c.total!==null&&(!Number.isSafeInteger(c.total)||c.total<0)||!Number.isSafeInteger(c.returned)||c.returned<0||!Number.isSafeInteger(c.selected)||c.selected<0||c.selected>c.returned||c.selected!==s.facts.filter(f=>f.source===c.source).length)fail();
  }
 }
 return p;
}
