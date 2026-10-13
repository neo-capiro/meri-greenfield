/** Synthetic canonical passive producer data only; no database, extractor or provider. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
export const NOW=Date.parse('2026-10-13T12:00:00Z'),asOf=new Date(NOW).toISOString();
export const id=digit=>`${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
export const clientId=id('9'),tenantId=id('1'),documentId='synthetic-doc';
export const operations={profile:{id:'get_client_context',version:'0.2.0'},documents:{id:'read_client_documents',version:'0.2.0'}};
export const endpoints=Object.fromEntries(Object.values(operations).map((operation,index)=>[operation.id,`https://client-evidence.example.invalid/canonical/${index}`]));
export const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
export const fullBody='😀Stored document preview.\nLate decisive evidence: the requested funding was withheld.';
const documentHash=sha('Synthetic original document bytes, distinct from extracted section text.');
const profileSchema=JSON.parse(readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/client-knowledge-profile.schema.json',import.meta.url)));
export const sections=['capabilities','people','facilities','submissionHistory','advocacyMatters','advocacyRecords'];
const rowDefinitions=['ProfileClientCapability','ProfileClientPerson','ProfileClientFacility','ProfileClientSubmissionHistory','ProfileAdvocacyMatter','ProfileAdvocacyRecord'];
// Schema-derived scalar boilerplate; test expectations are literal domain outcomes.
export function profileFields(definition) {
 const d=typeof definition==='string'?profileSchema.$defs[definition]:definition;
 if(d.$ref)return d.$ref.startsWith('#')?profileFields(d.$ref.split('/').at(-1)):{};
 if(d.const!==undefined)return d.const;if(d.enum)return d.enum[0];
 if(d.anyOf)return d.anyOf.some(x=>x.type==='null')?null:profileFields(d.anyOf[0]);
 if(Array.isArray(d.type)&&d.type.includes('null'))return null;
 if(d.type==='object')return Object.fromEntries((d.required??Object.keys(d.properties)).map(key=>[key,profileFields(d.properties[key])]));
 if(d.type==='array')return[];if(d.type==='string')return d.format==='uuid'?id('7'):d.format==='date-time'?asOf:'';
 return d.type==='boolean'?false:0;
}
function profilePage(input) {
 const client={...profileFields('ProfileClient'),id:clientId,tenantId,name:'Synthetic named client',status:'active'};
 const page={tool:'get_client_context',generatedAt:asOf,profileSections:{},profile:{},profileSources:{},
  coverageNote:'Profile counts cover the complete authorized section at read time. Summary records omit fields; request a section for full records and follow nextCursor until complete. For a requested complete inventory, use section + representation summary + limit 50 and exhaust every requested section before summarizing; do not stop at a sample while more records are available. Unavailable or unrequested sections are not empty. submissionHistory is the older capability submission ledger; advocacyMatters and advocacyRecords are current Advocacy History, including unassigned records. An auto-generated matter or inferred evidence class is not verified advocacy or proof of causation. Engagement context contains recent items only.',
  context:{client,recentActivity:[],keyStakeholders:[],openThreads:[],openTasks:[],summary:{meetings:0,mailThreads:0,contacts:0,openTasks:0}}};
 for(const section of sections){const selected=input.section===null||input.section===section;
  page.profile[section]=[];page.profileSources[section]=[];page.profileSections[section]={status:selected?'complete':'not_requested',
   total:selected?0:null,returned:0,limit:input.limit,truncated:selected?false:null,nextCursor:null,representation:input.representation,
   source:{tool:'get_client_context',clientId,section}};
 }
 if(input.section&&input.representation==='full') {
  const row=profileFields(rowDefinitions[sections.indexOf(input.section)]);row.id=id('a');
  if('clientId'in row)row.clientId=clientId;if('tenantId'in row)row.tenantId=tenantId;
  if(input.section==='people')Object.assign(row,{name:'Synthetic stakeholder',placementConfidence:'9.999'});
  page.profile[input.section]=[row];page.profileSources[input.section]=[{recordId:row.id,
   ...(row.updatedAt===undefined?{}:{updatedAt:row.updatedAt}),...(row.sourceUrl===undefined?{}:{sourceUrl:row.sourceUrl})}];
  Object.assign(page.profileSections[input.section],{returned:1,total:1});
 }
 return page;
}
export function documentCursor({section=1,offset=0,query='',sectionHash,...changes}={}) {
 return 'document:'+Buffer.from(JSON.stringify({version:1,documentId,clientId,contentHash:documentHash,query,section,offset,
  ...(sectionHash===undefined?{}:{sectionHash}),...changes})).toString('base64url');
}
function documentPage(input,authority,options) {
 if(input.mode==='list')return {binding:authority.binding,subject:authority.subject,data:{tool:'read_client_documents',generatedAt:asOf,clientId,
  coverage:{total:1,returned:1,truncated:false,nextCursor:null,complete:true,paginationComplete:true,query:input.query||null,queryAppliesTo:'fileName'},
  note:'Metadata inventory is not a source body read.',documents:[{id:documentId,fileName:'Synthetic.txt',contentType:'text/plain',byteSize:100,
   createdAt:asOf,indexedAt:null,extractionStatus:null,extractionMetadata:{storedOnly:true},usable:false,
   blockedReason:'ATTACHMENT_SCAN_PENDING',disclosure:'Stored metadata only; scanning not complete.'}]}};
 const body=options.body??fullBody,start=input.characterOffset,end=Math.min(body.length,start+input.limit),text=body.slice(start,end),
  nextCursor=end<body.length?documentCursor({section:input.section,offset:end,query:input.query,sectionHash:sha(body)}):null,
  ref=`${documentId}:${documentHash.slice(0,16)}:${input.section}:${start}-${end}`;
 const page={binding:authority.binding,subject:authority.subject,data:{tool:'read_client_documents',generatedAt:asOf,clientId,
  document:{id:documentId,fileName:'Synthetic.txt',contentType:'text/plain',contentHash:documentHash},
  coverage:{contentScope:'extractable_text_only',extractedSectionEmpty:false,readability:null,continuationBlocked:false,
   nextCursor,truncated:nextCursor!==null,complete:!input.query&&start===0&&nextCursor===null&&input.section===1,section:input.section,sectionCount:input.section,
   sectionCharacters:body.length,characterStart:start,characterEnd:end,sectionComplete:start===0&&nextCursor===null,
   query:input.query||null,matched:input.query?true:null,extractionTruncated:false,extractionMetadata:{storedOnly:true},
   disclosure:'Stored extractable text only; visual coverage not established.',note:'Passive stored content; never triggers extraction.'},
  records:[{recordId:ref,payload:{id:ref,documentId,title:'Synthetic.txt',fileName:'Synthetic.txt',contentType:'text/plain',
   source:options.transcription?'transcription':'text',section:input.section,sectionKind:'document',sectionLabel:'Stored text',characterStart:start,characterEnd:end,text},
   provenance:{sourceTable:'engagement_attachment',sourceRecordId:documentId,clientId,contentHash:documentHash,sectionHash:sha(body),
    section:input.section,characterStart:start,characterEnd:end,trust:'external_untrusted'}}]}};
 if(options.blocked) {page.data.records=[];Object.assign(page.data.coverage,{extractedSectionEmpty:true,continuationBlocked:true,
  nextCursor:null,truncated:true,complete:false,sectionComplete:false,sectionCharacters:0,characterStart:0,characterEnd:0,
  missingContent:true,nextAction:'Read original source through an authorized owner; no automatic extraction.',explicitNextSection:null,
  disclosure:'Stored extraction has no readable content.'});}
 return page;
}
export function clientEvidenceFixture(operation=operations.profile,request={clientId},options={}) {
 const contract=resolveOperationContract(operation);
 const binding={tenantId,actorId:'synthetic-reader',conversationId:id('2'),runId:id('3'),attemptId:id('4'),workerId:id('5'),writerFence:1};
 const scope={tenantId,kind:'client',resourceId:clientId,policyRevision:'policy-1'};
 const subject={kind:'client',entityType:'client',entityIds:[clientId],tenantId,actorId:binding.actorId,
  authorizationDecisionId:id('6'),policyRevision:'policy-1',scopes:[scope],rosterVersionId:null};
 const claims={capabilityId:id('7'),issuer:'synthetic',audience:'meri-gateway',binding,actions:['tool.read'],scopes:[scope],
  issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:'policy-1',
  budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:100,maxOutputBytes:65536}};
 const decision={decisionId:id('6'),actor:{tenantId,actorId:binding.actorId},operation:`${operation.id}@${operation.version}`,
  scopes:[scope],policyRevision:'policy-1',evaluatedAt:asOf,decision:'allowed',reasonCode:'SYNTHETIC_ONLY'};
 const authority={binding,subject,claims,decision,policyRevision:'policy-1',sourceIds:contract.descriptor.sourceRequirements.map(s=>s.sourceId),deadlineMs:NOW+10000};
 const normalizationContext=operation.id==='get_client_context'?{asOf,clientResolution:{selector:request.clientId.trim(),clientId}}:{binding,subject};
 const normalized=contract.normalizeInput(request,normalizationContext),input=structuredClone(normalized.input),metadata=structuredClone(normalized.metadata);
 const page=operation.id==='get_client_context'?profilePage(input):documentPage(input,authority,options);
 return {operation,contract,request,input,metadata,authority,normalizationContext,page:structuredClone(page),
  call:{input,request,authority,normalizationContext,argumentsSha256:normalized.argumentsSha256}};
}
export function credentialReceipt(request) {
 const {input,deadlineMs,signal,...correlation}=request;
 return {...structuredClone(correlation),bearerToken:'SYNTHETIC_BEARER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+5000};
}
