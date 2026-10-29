/** Office's fixed Core retention wire, using the existing service-authenticated
 * transport and lifetime. No retries, suppression decision or credential store. */
import {own,subject,uuid,fail} from './boundary.mjs';
const version='meri.office-draft-retention.v1';
const unavailable=()=>fail('RETENTION_AUTHORITY_UNAVAILABLE');
export function officeCoreClient(call){
 async function request(operation,raw,options){
  const s=subject(raw),input={tenantId:uuid(s.tenantId),subject:{kind:s.kind,id:s.subjectId}};
  const fields=operation==='read'?['drafts','active','bytes']:['retired','remaining'];
  const r=own(await call('office-draft-retention/'+operation,input,options),['version','tenantId','subject',...fields]);
  const target=own(r.subject,['kind','id']);
  if(r.version!==version||r.tenantId!==s.tenantId||target.kind!==s.kind||target.id!==s.subjectId)unavailable();
  if(operation==='read'){
   if(['drafts','active','bytes'].some(k=>!Number.isSafeInteger(r[k])||r[k]<0)||r.active>r.drafts||
      r.active===0&&r.bytes!==0||r.drafts===0&&r.active!==0)unavailable();
  }else if(!Number.isSafeInteger(r.retired)||r.retired<0||r.retired>100||typeof r.remaining!=='boolean')unavailable();
  return Object.freeze(r);
 }
 return Object.freeze({read:(s,options)=>request('read',s,options),retire:(s,options)=>request('retire',s,options)});
}
