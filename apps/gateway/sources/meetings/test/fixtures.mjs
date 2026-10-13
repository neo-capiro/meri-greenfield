/** Synthetic canonical producer data only; no native meetings or credentials. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
export const NOW=Date.parse('2026-10-13T11:00:00Z');
export const id=digit=>`${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
export const clientId=id('9'),meetingId=id('8'),noteId=id('7'),transcriptId=id('6');
export const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
export const operations=Object.freeze({upcoming:{id:'meeting.list_upcoming_meetings',version:'0.2.0'},
  debrief:{id:'meeting.query_debriefs',version:'0.2.0'},read:{id:'meeting.read_client_meetings',version:'0.2.0'}});
export const endpoints=Object.freeze(Object.fromEntries(Object.values(operations).map((op,index)=>[op.id,`https://meetings.example.invalid/canonical/${index}`])));
export const fullBody='😀Meeting note preview.\nLate decisive evidence: funding was withheld.';
export function meetingFixture(operation,request={},options={}) {
  const contract=resolveOperationContract(operation),normalized=contract.normalizeInput(request,{nowMs:NOW});
  const input=structuredClone(normalized.input),metadata=structuredClone(normalized.metadata);
  const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id('1'),runId:id('2'),
    attemptId:id('3'),workerId:id('4'),writerFence:1};
  const scope={tenantId:binding.tenantId,kind:input.clientId===null?'private-user':'client',
    resourceId:input.clientId??binding.actorId,policyRevision:'policy-1'};
  const subject={kind:input.clientId===null?'personal':'client',entityType:input.clientId===null?'user':'client',
    entityIds:[input.clientId??binding.actorId],tenantId:binding.tenantId,actorId:binding.actorId,
    authorizationDecisionId:id('5'),policyRevision:'policy-1',scopes:[scope],rosterVersionId:null};
  const claims={capabilityId:id('0'),issuer:'synthetic',audience:'meri-gateway',binding,actions:['tool.read'],scopes:[scope],
    issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:'policy-1',
    budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:100,maxOutputBytes:65536}};
  const decision={decisionId:id('5'),actor:{tenantId:binding.tenantId,actorId:binding.actorId},
    operation:`${operation.id}@${operation.version}`,scopes:[scope],policyRevision:'policy-1',
    evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'};
  const authority={binding,claims,subject,decision,policyRevision:'policy-1',sourceIds:['meetings'],deadlineMs:NOW+10000};
  const envelope=(kind,count,truncated,requiredReads=[])=>({kind,contractVersion:'0.2.0',operation,
    requestId:id('a'),traceId:id('b'),binding,subject,window:{basis:'unbounded'},argumentsSha256:canonicalSha256(input),
    appliedFilters:[],selection:input,snapshotVersionId:null,
    sources:[{sourceId:'meetings',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',
      status:'partial',synchronizedAt:null,asOf:null,retrievedAt:new Date(NOW).toISOString(),freshness:'unknown'}],
    coverage:{sourcesRequested:['meetings'],sourcesChecked:['meetings'],sourcesUnavailable:[],enumeration:'unknown',
      enumerableTotal:null,returnedCount:count,truncated,historySupport:'bounded',
      limitations:['Synthetic producer: snapshot, history and native source qualification unavailable.']},
    continuation:{cursor:null,requiredReads,remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}});
  let page;
  if(operation.id===operations.upcoming.id) {
    const row={id:meetingId,subject:'Synthetic calendar meeting',startsAt:new Date(NOW+3600000).toISOString(),
      endsAt:new Date(NOW+7200000).toISOString(),location:null,isVirtual:true,joinLink:'https://example.invalid/preview',
      status:'scheduled',isInternal:false,organizer:'synthetic@example.invalid',client:input.clientId===null?null:{id:input.clientId,name:'Synthetic'},attendees:[]};
    page={...envelope('meeting-upcoming-page',1,input.limit===1),order:'startsAt-asc_nulls-and-ties-unspecified',
      calendarWindow:{from:new Date(NOW).toISOString(),to:new Date(NOW+input.withinDays*86400000).toISOString(),withinDays:input.withinDays},meetings:[row],count:1};
  }else if(operation.id===operations.debrief.id) {
    const body=options.body??fullBody,start=input.debriefId===null?0:(options.start??input.characterOffset),
      end=Math.min(body.length,start+input.characterLimit),returned=body.slice(start,end),complete=start===0&&end===body.length,
      nextCursor=end<body.length?'synthetic-debrief-next':null;
    const row={id:input.debriefId??noteId,meetingId,clientId:input.clientId,
      meeting:{id:meetingId,clientId:input.clientId,subject:'Synthetic review',startsAt:new Date(NOW).toISOString()},body:returned,
      status:'approved',authorUserId:binding.actorId,author:{id:binding.actorId,email:'synthetic@example.invalid',firstName:null,lastName:null},
      createdAt:new Date(NOW-10000).toISOString(),updatedAt:new Date(NOW-5000).toISOString(),
      bodyCoverage:{characterStart:start,characterEnd:end,totalCharacters:body.length,complete,pageComplete:true,
        truncated:nextCursor!==null,nextCursor,note:'Exact UTF-16 source window; incomplete windows require more reading.'},
      provenance:{sourceTable:'meeting_debriefs',sourceRecordId:input.debriefId??noteId,sourceVersion:new Date(NOW-5000).toISOString(),
        parentMeetingId:meetingId,currentClientId:input.clientId,bodySha256:sha(body),returnedBodySha256:sha(returned)}};
    const cursorApplied=metadata.cursor!==null,exact=input.debriefId!==null,paginationComplete=exact||nextCursor===null;
    const pageComplete=!cursorApplied&&complete&&paginationComplete;
    page={...envelope('debrief-source-page',1,!pageComplete,complete?[]:[nextCursor??'window-resumed']),
      order:'createdAt-asc_id-asc_cursor-key-owner-unconfirmed',scope:{debriefId:input.debriefId,from:input.from,to:input.to,
        timeField:'meeting.startsAt',statusEligibility:'approved_only',characterOffset:exact?start:null,
        characterLimit:input.characterLimit,listLimit:input.limit,cursorApplied},
      pageCoverage:{sourceStatus:'healthy',sourceReason:null,pageComplete:true,complete:pageComplete,partial:!pageComplete,
        paginationComplete,bodyCoverageComplete:complete,truncated:nextCursor!==null||!complete,nextCursor,
        totalIsReturnedPageOnly:true,appliesTo:'approved_only_eligible_debriefs',note:'Synthetic debrief source page.'},
      total:1,returned:1,debriefs:[row]};
  }else if(input.sourceId!==undefined) {
    const body=options.body??fullBody,start=options.start??input.characterOffset,end=Math.min(body.length,start+input.characterLimit),
      returned=body.slice(start,end),complete=start===0&&end===body.length,truncated=end<body.length,nextCursor=truncated?'synthetic-meeting-next':null;
    const version=input.sourceKind==='note'?new Date(NOW-5000).toISOString():sha(body);
    page={...envelope('meeting-source-body-page',1,truncated,truncated?[nextCursor]:[]),
      scope:{meetingId:input.meetingId,sourceKind:input.sourceKind,sourceId:input.sourceId,from:null,to:null,
        cursorApplied:metadata.cursor!==null,characterOffset:start,characterLimit:input.characterLimit},returned:1,
      pageCoverage:{sourceStatus:'healthy',pageComplete:true,meetingPaginationComplete:true,sourceInventoryComplete:true,
        sourceBodyCoverageComplete:complete,complete,partial:!complete,truncated,nextCursor,note:'Exact body, not inventory.'},
      meeting:{id:input.meetingId,clientId:input.clientId,subject:'Synthetic review',startsAt:new Date(NOW).toISOString(),
        endsAt:new Date(NOW+3600000).toISOString(),status:'scheduled',updatedAt:new Date(NOW-5000).toISOString(),sourceAvailability:{notes:'available',transcript:'available',transcriptReason:null}},
      source:{sourceKind:input.sourceKind,sourceId:input.sourceId,sourceVersion:version,meetingId:input.meetingId,clientId:input.clientId,
        lifecycleStatus:'approved',availability:'available',availabilityReason:null,contentHash:sha(body),
        createdAt:new Date(NOW-10000).toISOString(),updatedAt:new Date(NOW-5000).toISOString(),body:returned,
        bodyCoverage:{characterStart:start,characterEnd:end,totalCharacters:body.length,complete,pageComplete:true,truncated,nextCursor},
        provenance:{owner:input.sourceKind==='note'?'meeting_notes':'engagement_attachment_storage',sourceKind:input.sourceKind,
          sourceId:input.sourceId,sourceVersion:version,meetingId:input.meetingId,currentClientId:input.clientId,
          bodySha256:sha(body),returnedBodySha256:sha(returned),encoding:'utf8',sourceByteLength:Buffer.byteLength(body),returnedByteLength:Buffer.byteLength(returned)}}};
  }else {
    page={...envelope('meeting-inventory-page',1,true),scope:{meetingId:input.meetingId,sourceKind:null,sourceId:null,
      from:input.from,to:input.to,cursorApplied:metadata.cursor!==null,limit:input.limit},order:'startsAt-asc_id-asc_cursor-key-owner-unconfirmed',returned:1,
      meetings:[{id:input.meetingId??meetingId,clientId:input.clientId,subject:'Synthetic inventory',startsAt:new Date(NOW).toISOString(),
        endsAt:new Date(NOW+3600000).toISOString(),status:'scheduled',updatedAt:new Date(NOW-5000).toISOString(),sources:[{sourceKind:'note',sourceId:noteId,
          sourceVersion:new Date(NOW-5000).toISOString(),meetingId:input.meetingId??meetingId,clientId:input.clientId,
          lifecycleStatus:'approved',availability:'available',availabilityReason:null,contentHash:sha(fullBody),
          createdAt:new Date(NOW-10000).toISOString(),updatedAt:new Date(NOW-5000).toISOString()}],
        sourceAvailability:{notes:'available',transcript:'unavailable',transcriptReason:'calendar_event_without_persisted_transcript'}}],
      pageCoverage:{sourceStatus:'healthy',pageComplete:true,meetingPaginationComplete:true,sourceInventoryComplete:true,
        sourceBodyCoverageComplete:false,complete:false,partial:true,truncated:true,omittedMeetings:0,nextCursor:null,
        note:'Inventory only; exact source body has not been read.'}};
  }
  return {operation,contract,request,input,metadata,authority,page:structuredClone(page),call:{input,request,authority,argumentsSha256:normalized.argumentsSha256}};
}
export function credentialReceipt(request) {
  const {input,deadlineMs,signal,...correlation}=request;
  return {...structuredClone(correlation),bearerToken:'SYNTHETIC_BEARER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+5000};
}
