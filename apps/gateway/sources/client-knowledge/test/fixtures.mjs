/** Entirely public synthetic projections and scoped broker ports. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
export const NOW=Date.parse('2026-10-13T14:00:00.000Z');
export const uuid=digit=>`${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex'),clone=value=>structuredClone(value);
export const memoryText=`Public synthetic approved note. ${'x'.repeat(900)} 😀 The allocation was approved after review.`;
export const endpoints=Object.freeze({search_memory:'https://canonical-knowledge.example.invalid/memory',
  read_monday_client_boards:'https://canonical-knowledge.example.invalid/monday'});
const source=(domain,count=1)=>({domain,sourceStatus:'healthy',returned:count,recordsEvaluated:count,requestedEntityCount:1,searchedEntityCount:1,
  pagesRead:1,hasMore:false,truncated:false,paginationComplete:true,coverageComplete:true,stopReason:'synthetic-complete-page'});
const coverage=(domain,count=1)=>({requestedDomains:[domain],searchedDomains:[domain],requestedEntityCount:1,searchedEntityCount:1,
  recordsEvaluated:count,recordsReturned:count,paginationComplete:true,unavailableSources:[],sources:[source(domain,count)],complete:true,stopReason:'done'});
export function createClientKnowledgeFixture(id='search_memory',{client=id==='read_monday_client_boards'}={}) {
  const operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),state={now:NOW},calls=[],wire=[],credentialCalls=[],eligibilityCalls=[];
  const binding={tenantId:uuid('1'),actorId:uuid('2'),conversationId:uuid('3'),runId:uuid('4'),attemptId:uuid('5'),workerId:uuid('6'),writerFence:1};
  const clientId=uuid('a'),scope={tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?clientId:binding.actorId,policyRevision:'synthetic-policy-1'};
  const claims={capabilityId:uuid('7'),issuer:'synthetic-issuer',audience:'meri-gateway',binding,actions:['tool.read'],scopes:[clone(scope)],
    issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:scope.policyRevision,
    budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:1,maxOutputBytes:1048576}};
  const subject={kind:client?'client':'personal',entityType:client?'client':'user',entityIds:[client?clientId:binding.actorId],tenantId:binding.tenantId,
    actorId:binding.actorId,authorizationDecisionId:uuid('8'),policyRevision:scope.policyRevision,scopes:[clone(scope)],rosterVersionId:null};
  const decision={decisionId:subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${id}@0.2.0`,
    scopes:clone(subject.scopes),policyRevision:scope.policyRevision,evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'};
  const authority={binding,claims,subject,decision,policyRevision:scope.policyRevision,sourceIds:contract.descriptor.sourceRequirements.map(row=>row.sourceId),deadlineMs:NOW+10000};
  const normalizationContext=id==='search_memory'?{tenantId:binding.tenantId,userId:binding.actorId}:{};
  const args=id==='search_memory'?{query:'  approved allocation  ',...(client?{clientId}:{})}:{clientId,pageSize:1,boardContext:'model selector is inert'};
  const normalized=(request=args)=>contract.normalizeInput(request,normalizationContext),input=(request=args)=>normalized(request).input;
  const mapping={tenantId:binding.tenantId,userId:binding.actorId,clientId,mappingVersionId:'synthetic-managed-mapping-v1',boardIds:['101']};
  function page(selection=input()) {
    if(id==='read_monday_client_boards')return {tool:id,authoritativeOwner:'managed_monday_mcp',currentStatus:'healthy',clientId:selection.clientId,
      records:[{domain:'monday',recordId:'101:202',payload:{clientId:selection.clientId,sourceActorUserId:binding.actorId,title:{text:'Synthetic board item'},
        status:null,owners:[{id:7}],dueDate:null,origin:{provider:'monday',boardId:'101',itemId:'202',itemType:'item',scope:'saved_mapping'},
        updates:[{body:'Public synthetic update'}],columns:[{value:{inert:true}}],url:'https://synthetic.monday.com/boards/101/pulses/202'},
        provenance:{source:'managed_monday_mcp',boardId:'101',itemId:'202'}}],coverage:coverage('monday')};
    const recordId=selection.memoryItemId??uuid('b'),version='synthetic-memory-v1',bodyHash=hash(memoryText+'\0'+version);
    const offset=selection.contentCursor?JSON.parse(Buffer.from(selection.contentCursor,'base64url')).offset:0;
    const end=selection.memoryItemId?memoryText.length:500,value=memoryText.slice(offset,end),truncated=end<memoryText.length;
    const content={hash:bodyHash,totalCharacters:memoryText.length,offset,endOffset:end,truncated,nextRead:truncated?{
      query:'Read this approved memory',memoryItemId:recordId,...(selection.clientId?{clientId:selection.clientId}:{}),
      contentCursor:Buffer.from(JSON.stringify({version:1,itemId:recordId,scope:hash(JSON.stringify([binding.tenantId,binding.actorId,selection.clientId])),hash:bodyHash,offset:end})).toString('base64url')}:null};
    const row={domain:'institutional_knowledge',recordId,updatedAt:new Date(NOW-2000).toISOString(),retrievalSignals:{semanticSimilarity:0.8},
      provenance:{source:'memory_items',recordId,startOffset:offset,endOffset:end,sourceType:'firm_playbook',sourceId:'synthetic-source',
        sourceRef:'synthetic-source-ref',sourceExcerpt:null,contentHash:null,sourceVersion:version,metadataTruncated:false},
      payload:{sourceKind:'governed_memory',memoryItemId:recordId,title:'Synthetic approved memory',titleTruncated:false,type:'fact',scope:'firm',clientId:null,
        governance:{memoryClass:'institutional_authoritative',authority:'firm_approved',status:'active',conflictStatus:null,controllingItemId:null,
          approvedByUserId:uuid('c'),approvedAt:new Date(NOW-3000).toISOString(),asOf:null,effectiveFrom:null,validUntil:null,expiresAt:null,
          lastConfirmedAt:null,reviewDueAt:null,stale:false,instructionsAllowed:false},contentStatus:'available',contentLimitation:null,content,value}};
    return {tool:id,coverage:coverage('institutional_knowledge'),observability:{queryClass:'semantic_recall',requestedDomains:['institutional_knowledge'],
      queriedDatasets:['institutional_knowledge'],requestedEntityCount:1,queriedEntityCount:1,pagesByDomain:{},sourceHealth:{},freshnessByDomain:{},coverageComplete:true,stopReason:'done'},
      summary:'1 governed memory item(s) returned. Follow content.nextRead for complete approved content; coverage describes the search.',
      requestedPageSize:selection.k,effectivePageSize:selection.memoryItemId?1:Math.min(selection.k,3),nextCursor:null,
      governanceCoverage:{searched:'Eligible active governed memory, including stale or controlling conflicted records when policy allows',
        excluded:'Pending proposals, rejected, withdrawn, revoked, superseded and non-controlling conflicts are not active recall. Their absence here does not establish that no such proposals or historical records exist.'},
      factContentUnavailableCount:0,contentStatus:'available',contentTruncated:truncated,
      results:[{id:recordId,memoryItemId:recordId,title:row.payload.title,type:row.payload.type,clientId:null,relevance:0.8}],records:[row]};
  }
  const receiptPins=pins=>({operation:clone(pins.operation),argumentsSha256:pins.argumentsSha256,metadata:clone(pins.metadata),
    normalizationContext:clone(pins.normalizationContext),requestSha256:pins.requestSha256,binding:clone(pins.binding),subject:clone(pins.subject),
    policyRevision:pins.policyRevision,sourceIds:clone(pins.sourceIds)});
  const credentials=pins=>({...receiptPins(pins),bearerToken:'SYNTHETIC_KNOWLEDGE_TOKEN',serviceSecret:'SYNTHETIC_SERVICE_SECRET',expiresAtMs:NOW+10000,
    ...(id==='read_monday_client_boards'?{managedBoardMapping:clone(mapping)}:{})});
  const eligibility=pins=>({...receiptPins(pins),resultSha256:pins.resultSha256,checkedAtMs:state.now,expiresAtMs:pins.deadlineMs,
    records:pins.records.map(row=>({...clone(row),eligibleForRecall:true}))});
  const config={endpoints,now:()=>state.now,maxRequestMs:1000,maxResponseBytes:1048576,
    async getCredentials(pins){calls.push('credentials');credentialCalls.push(pins);return credentials(pins);},
    async readMemoryEligibility(pins){calls.push('eligibility');eligibilityCalls.push(pins);return eligibility(pins);},
    async fetchImpl(url,options){calls.push('fetch');wire.push({url,options});return new Response(JSON.stringify(page(JSON.parse(options.body).input)),{headers:{'content-type':'application/json'}});}};
  const call=(request=args,current=authority)=>({input:input(request),request,authority:current,normalizationContext,
    argumentsSha256:normalized(request).argumentsSha256});
  return {operation,contract,state,calls,wire,credentialCalls,eligibilityCalls,binding,claims,subject,authority,normalizationContext,args,
    normalized,input,mapping,page,receiptPins,credentials,eligibility,config,call,clientId};
}
