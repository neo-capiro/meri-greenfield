/** Bounded published-version lookup for the explicit source-local store. */
const fail=()=>{throw Object.assign(new Error('ARTIFACT_REPLAY_UNRESOLVED'),{code:'ARTIFACT_REPLAY_UNRESOLVED'});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[0-9a-f]{64}$/;
const limit=1024;
export async function readLocalReplay(query,{readVersion,readHead,listVersions,hash,check}){
  if(!query||Object.keys(query).sort().join()!=='kind,requestSha256,resultSha256,versionId'||query.kind!=='artifact-replay'||
    !uuid.test(query.versionId)||!digest.test(query.requestSha256)||!(query.resultSha256===null||digest.test(query.resultSha256)))fail();
  const matches=record=>record?.requestSha256===query.requestSha256&&
    (query.resultSha256===null?record?.version?.versionId===query.versionId:
      hash({...record,expectedParentVersionId:record?.version?.parentVersionId})===query.resultSha256);
  const cache=new Map();let totalBytes=0;
  async function optional(id){
    check();if(!uuid.test(id))fail();if(cache.has(id))return cache.get(id);
    try{
      const {record,bytes}=await readVersion(id);check();
      if(!Number.isSafeInteger(bytes)||bytes<1||bytes>4194304||(totalBytes+=bytes)>16777216||record?.version?.versionId!==id)fail();
      cache.set(id,record);return record;
    }catch(e){if(e.code==='ENOENT'){cache.set(id,null);return null;}throw e;}
  }
  async function published(record){
    const artifactId=record?.version?.artifactId,target=record?.version?.versionId;
    if(!uuid.test(artifactId)||!uuid.test(target))fail();
    let head;try{head=await readHead(artifactId);}catch(e){if(e.code==='ENOENT')return false;throw e;}
    const visited=new Set();
    while(head!==null){
      check();if(!uuid.test(head)||visited.has(head)||visited.size>=limit)fail();visited.add(head);
      const node=await optional(head);if(!node||node.version?.versionId!==head||node.version?.artifactId!==artifactId)fail();
      if(head===target)return hash(node)===hash(record);
      head=node.version.parentVersionId;
    }
    return false;
  }
  const exact=await optional(query.versionId);
  if(exact&&matches(exact)&&await published(exact))return exact;
  // Old random version IDs require the exact retained completion digest. A request
  // digest alone cannot distinguish two independent deliveries of identical input.
  if(query.resultSha256===null)fail();
  const names=await listVersions();check();if(names.length>limit)fail();
  let found=null;
  for(const name of names){
    check();if(!name.endsWith('.json')||!uuid.test(name.slice(0,-5)))continue;
    const record=await optional(name.slice(0,-5));
    if(record&&matches(record)&&await published(record)){if(found)fail();found=record;}
  }
  if(!found)fail();return found;
}
