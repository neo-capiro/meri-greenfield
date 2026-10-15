/** Observation envelopes the scripted runtime emits. Values come only from what a target returned at the runner-visible paths. */
export function at(value,path){
 let cursor=value;for(const key of path.split('.')){if(cursor===null||typeof cursor!=='object'||!Object.hasOwn(cursor,Array.isArray(cursor)?Number(key):key))return {found:false};cursor=cursor[Array.isArray(cursor)?Number(key):key];}
 return {found:true,value:cursor};
}
/** One claim per runner-visible evidence path, citing the evidence it was read from. */
export function observedAnswer(view,{kind='answer',source,observed,files=[]}){
 const evidence={},claims=[];
 for(const {evidenceId,path} of view.evidence){const hit=at(observed,path);
  evidence[evidenceId]=hit.found?{source,path,value:hit.value}:{source,path,missing:true};
  if(hit.found)claims.push({text:`${path} is ${JSON.stringify(hit.value)}`,value:hit.value,evidenceIds:[evidenceId]});}
 return {caseId:view.caseId,kind,claims,evidence,files,refusal:null,observed};
}
export const observedRefusal=(view,code,observed)=>({caseId:view.caseId,kind:'refusal',claims:[],evidence:{},files:[],refusal:{code},observed});
export const fileRecord=(version,bytes)=>({versionId:version.versionId,filename:version.filename,mimeType:version.mimeType,bytes:version.object.bytes,sha256:version.object.sha256,base64:Buffer.from(bytes).toString('base64')});
