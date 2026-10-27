/** Synthetic Core response with canonical SemanticSuggestionService binding order. */
import {hash} from 'node:crypto';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
const clientId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export function relevanceCase({verified=false}={}){
 const scene=billTextCase(),operation={id:'preview_legiwatch_relevance',version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const request={clientId,folderId:'folder',jurisdiction:'US',sessionKey:'119',fields:['title'],billId:'hr1-119',...(verified?{explanation:'Relevant for client review',documentId:'hr1-119:title',start:0,end:4,quote:'😀界文'}:{})};
 authority.decision.operation=operation.id+'@0.2.0';authority.sourceIds=contract.descriptor.sourceRequirements.map(s=>s.sourceId);
 const normalizationContext={legiwatchReviewScope:{clientId,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
 const coverage={complete:false,inspectedDocuments:1,missing:['FULL_DOCUMENT_CORPUS_NOT_QUALIFIED']};
 const semantic={scope:{jurisdiction:request.jurisdiction,sessionKey:request.sessionKey,fields:request.fields},folderId:request.folderId,billId:request.billId,explanation:request.explanation,documentId:request.documentId,start:request.start,end:request.end,quote:request.quote};
 const binding={input:semantic,sourceFingerprint:'c'.repeat(64),folderVersion:3};
 const data=verified?{input:semantic,binding,previewHash:hash('sha256',JSON.stringify(binding),'hex'),coverage,effects:[{kind:'pending_semantic_suggestion',automaticAssignment:false}]}:
 {bill:{id:request.billId,number:'H.R.1',title:'😀界文',sponsor:null,jurisdiction:request.jurisdiction,sessionKey:request.sessionKey,status:null,latestAction:null,latestActionAt:null,sourceUrl:null},documents:[{id:'hr1-119:title',billId:request.billId,kind:'title',revision:'a'.repeat(64),observationId:'a'.repeat(64),sourceUrl:null,extractorVersion:'canonical-title-v1',text:'😀界文',complete:true,reason:null,excerptOnly:false}],coverage,effects:[],previewHash:null};
 const page={version:'0.1.0',tool:operation.id,generatedAt:new Date(now()).toISOString(),selection:request,data,effects:[],coverage:{basis:'current_owner_read',sourceUniverseComplete:false,maxOutputBytes:262144,limitations:['Source offsets are UTF16; retain incomplete or excerpted source labels.']}};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const p=structuredClone(state.page??page);state.resultMutator?.(p);state.afterSource?.();return Response.json(p);}};
 const call=()=>{const normalized=contract.normalizeInput(request,normalizationContext);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext,authority:readContext(authority)};};
 return {...scene,family:'legiwatch-relevance',operation,contract,arguments:request,normalizationContext,transport,page,call,visibleClientIds:[clientId]};
}
