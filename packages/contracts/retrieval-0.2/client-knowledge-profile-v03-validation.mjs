// Client-profile 0.3.0 owner windows; source services and visibility remain external.
import {snapshotOperationData} from './operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const fail=message=>{throw new Error(message);};
const operation='get_client_context';
const sections=Object.freeze(['capabilities','people','facilities','submissionHistory','advocacyMatters','advocacyRecords']);
const definitions=Object.freeze({capabilities:['ProfileClientCapability','ProfileCapabilitiesSummary'],people:['ProfileClientPerson','ProfilePeopleSummary'],facilities:['ProfileClientFacility','ProfileFacilitiesSummary'],submissionHistory:['ProfileClientSubmissionHistory','ProfileSubmissionHistorySummary'],advocacyMatters:['ProfileAdvocacyMatter','ProfileAdvocacyMattersSummary'],advocacyRecords:['ProfileAdvocacyRecord','ProfileAdvocacyRecordsSummary']});
const coverageNote='Profile counts cover the complete authorized section at read time. Summary records omit fields; request a section for full records and follow nextCursor until complete. For a requested complete inventory, use section + representation summary + limit 50 and exhaust every requested section before summarizing; do not stop at a sample while more records are available. Unavailable or unrequested sections are not empty. submissionHistory is the older capability submission ledger; advocacyMatters and advocacyRecords are current Advocacy History, including unassigned records. An auto-generated matter or inferred evidence class is not verified advocacy or proof of causation. Engagement context contains recent items only.';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
function instant(value){const t=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(t)||new Date(t).toISOString()!==value)fail('Profile canonical JSON timestamp required');return t;}
function excerpt(value,cap){if(value.length>cap||/[^\S ]| {2}/.test(value)||value!==value.trim())fail('Profile summarized excerpt mismatch');}
export function createClientKnowledgeProfileValidators({validateShape,schema}){
  if(typeof validateShape!=='function'||schema?.$id!=='urn:meri:retrieval:client-knowledge-profile:0.3.0'||!schema.$defs)fail('Profile contract configuration');
  const check=id=>{if(id!==operation)fail('Unknown profile operation');};
  const inputDefinition=id=>{check(id);return 'ClientKnowledgeProfileInput';};
  const outputDefinition=id=>{check(id);return 'ClientKnowledgeProfileOutput';};
  function decode(value){
    if(typeof value!=='string'||value.length>1024||!/^[\w-]+$/.test(value))fail('Invalid profile cursor');
    let data;try{data=snapshotOperationData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(value,'base64url'))));}catch{fail('Invalid profile cursor JSON');}
    validateShape('ProfileCursor',data);return data;
  }
  function normalizeInput(id,request,context){
    check(id);const raw=snapshotOperationData(request),ctx=snapshotOperationData(context);
    validateShape('ClientKnowledgeProfileRequest',raw);validateShape('ClientKnowledgeProfileContext',ctx);instant(ctx.asOf);
    const selector=raw.clientId.trim().slice(0,80);if(!selector||selector!==ctx.clientResolution.selector)fail('Profile client resolution selector mismatch');
    if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selector)&&selector.toLowerCase()!==ctx.clientResolution.clientId.toLowerCase())fail('Profile canonical client ID substitution');
    const input={clientId:ctx.clientResolution.clientId,section:raw.section??null,afterId:null,limit:raw.limit??25,representation:raw.representation??(raw.section?'full':'summary')};
    if(raw.cursor!==undefined){if(!input.section)fail('Profile cursor requires section');const cursor=decode(raw.cursor);if(cursor.clientId!==input.clientId||cursor.section!==input.section)fail('Profile cursor scope mismatch');input.afterId=cursor.afterId;}
    validateShape(inputDefinition(id),input);
    return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({sourceConnected:false,authoritative:false,currentPolicyQualified:false,absenceEvidence:false,engagementCoverage:'recent-only'})});
  }
  function assertResult(id,value,request,context){
    const ctx=snapshotOperationData(context),{input}=normalizeInput(id,request,ctx),page=snapshotOperationData(value);
    validateShape(outputDefinition(id),page);instant(page.generatedAt);
    const startedAt=instant(page.readWindow.startedAt),completedAt=instant(page.readWindow.completedAt);
    if(startedAt>completedAt||page.generatedAt!==page.readWindow.completedAt)fail('Profile source read window mismatch');
    if(page.context.client.id!==input.clientId||page.context.client.status==='archived'||page.coverageNote!==coverageNote)fail('Profile wrapper identity/observation mismatch');
    for(const section of sections){
      const c=page.profileSections[section],rows=page.profile[section],refs=page.profileSources[section];
      if(c.source.clientId!==input.clientId||c.source.section!==section||c.limit!==input.limit||c.representation!==input.representation||c.returned!==rows.length||rows.length>input.limit||refs.length!==rows.length)fail('Profile section selector/count mismatch');
      const notRequested=input.section!==null&&input.section!==section;
      if(notRequested?(c.status!=='not_requested'):c.status==='not_requested')fail('Profile requested-section mismatch');
      if(['unavailable','not_requested'].includes(c.status)){
        if(rows.length||c.total!==null||c.truncated!==null||c.nextCursor!==null||('error'in c)!==(c.status==='unavailable'))fail('Unavailable profile section fabricated evidence');
        continue;
      }
      if(c.total===null||c.truncated!==(c.status==='partial')||'error'in c||c.truncated&&rows.length!==input.limit)fail('Profile coverage completion mismatch');
      if(section!=='advocacyRecords'&&c.total<rows.length)fail('Profile same-read count mismatch');
      if(c.nextCursor!==null){const next=decode(c.nextCursor);if(!c.truncated||!rows.length||next.clientId!==input.clientId||next.section!==section||next.afterId!==rows.at(-1).id)fail('Profile next cursor mismatch');}
      else if(c.truncated&&rows.length)fail('Partial profile omitted next cursor');
      let previous=input.afterId;
      rows.forEach((row,index)=>{
        validateShape(definitions[section][input.representation==='full'?0:1],row);
        if(previous!==null&&row.id<=previous)fail('Profile immutable ID page order mismatch');previous=row.id;
        if(refs[index].recordId!==row.id)fail('Profile source-reference identity mismatch');
        if(row.updatedAt!==undefined&&(!('updatedAt'in refs[index])||!same(refs[index].updatedAt,row.updatedAt)))fail('Profile source-reference date mismatch');
        if(row.sourceUrl!==undefined&&refs[index].sourceUrl!==row.sourceUrl)fail('Profile source-reference URL mismatch');
        if('clientId'in row&&row.clientId!==input.clientId||'tenantId'in row&&row.tenantId!==page.context.client.tenantId)fail('Profile full-row scope substitution');
        if(input.representation==='summary'){
          const fields=section==='capabilities'?[['description',300],['districtNexus',200]]:section==='submissionHistory'?[['outcome',240]]:section==='advocacyMatters'?[['summary',300]]:section==='advocacyRecords'?[['summary',300],['outcome',240]]:[];
          for(const [key,cap]of fields)excerpt(row[key],cap);
        }
      });
    }
    const e=page.context;
    if(e.summary.contacts!==e.keyStakeholders.length||e.summary.openTasks!==e.openTasks.length||e.openThreads.length>e.summary.mailThreads)fail('Profile engagement count mismatch');
    let prior=Infinity;
    for(const activity of e.recentActivity){const time=instant(activity.date);if(time>prior)fail('Profile recent activity order mismatch');prior=time;}
    for(const thread of e.openThreads)if(thread.status==='closed'||thread.tenantId!==e.client.tenantId)fail('Profile open-thread projection mismatch');
    for(const task of e.openTasks)if(['done','canceled'].includes(task.status)||task.clientId!==input.clientId||task.tenantId!==e.client.tenantId)fail('Profile open-task projection mismatch');
    // Association-based meetings/mail can have a different or absent primary
    // client field. Returned rows do not prove current ownership or client walls.
    return page;
  }
  return Object.freeze({schemaId:schema.$id,operationIds:Object.freeze([operation]),inputDefinition,outputDefinition,normalizeInput,assertResult});
}
