/** Synthetic Core envelopes; no database, provider or live source qualification. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createCapiroDataHandlers,createCapiroData3Handlers} from '../handler.mjs';
export const ids=['describe_capiro_data','query_capiro_data'];
export const requests={describe_capiro_data:{relations:['program_elements']},query_capiro_data:{sql:'SELECT pe_code, total, count, absent FROM program_elements WHERE pe_code = $1',parameters:['0600001A'],rowLimit:2}};
export function capiroDataPage(id=ids[1]){
  const head={version:'0.2.0',generatedAt:'2026-10-26T12:00:00.000Z',ok:true};
  if(id===ids[0])return {...head,relations:[{name:'program_elements',description:'Synthetic relation',fields:[{name:'pe_code',type:'string',pgType:'text',nullable:false,description:'Canonical PE code'},{name:'value_kind',type:'string',pgType:'text',nullable:false,description:'total, quantity or unit_cost',enum:['total','quantity','unit_cost']}],primaryKey:['pe_code'],relationships:[],grain:'One row per PE code',coverage:{basis:'ingested_public_records',limitations:['Ingested records only']},freshness:{field:null,sourceAsOf:null,sourceVersion:null}}],limits:{defaultRowLimit:200,maxRowLimit:1000,maxOutputBytes:262144,maxSqlBytes:16384,maxParameters:64,maxParameterBytes:32768}};
  return {...head,columns:[{name:'pe_code',type:'string',pgType:'text',nullable:false},{name:'total',type:'decimal',pgType:'numeric',nullable:false,unit:'USD millions'},{name:'count',type:'integer',pgType:'int8',nullable:false},{name:'absent',type:'decimal',pgType:'numeric',nullable:true},{name:'last_synced_at',type:'timestamp',pgType:'timestamptz',nullable:true}],rows:[{pe_code:'0600001A',total:'100.10',count:'9007199254740993',absent:null,last_synced_at:'2026-01-01 00:00:00.123456+00'},{pe_code:'0600002A',total:'0',count:'0',absent:null,last_synced_at:null}],rowCount:2,relationsUsed:['program_elements'],rowLimitReached:false,byteTruncated:false,coverage:{basis:'query_bounded',sourceUniverseComplete:false,sqlLimit:null,relations:[{name:'program_elements',sourceAsOf:null,sourceVersion:null,limitations:['Ingested records only; no complete-source inference']}]},limits:{rowLimit:2,maxOutputBytes:262144}};
}
export function privateCapiroDataPage(id=ids[1],clientId=null){
  const page=capiroDataPage(id);page.version='0.3.0';page.scope={kind:'client_records',clientId};
  if(id===ids[0]){page.relations[0].name='client_objectives';page.relations[0].fields=['client_id','id','outcome'].map(name=>({name,type:'string',pgType:'text',nullable:false,description:'Synthetic stored field'}));page.relations[0].fields.push({name:'value_kind',type:'string',pgType:'text',nullable:false,description:'total, quantity or unit_cost',enum:['total','quantity','unit_cost']});page.relations[0].primaryKey=['client_id','id'];page.relations[0].coverage.basis='authorized_client_records';}
  else{page.relationsUsed=['client_objectives'];page.coverage.relations[0].name='client_objectives';page.columns[0].name='outcome';delete page.columns[1].unit;for(const row of page.rows){row.outcome=row.pe_code;delete row.pe_code;}}
  return page;
}
/** A Core 362 refusal carrying PostgreSQL's own diagnostics for the model's SQL. */
export function sqlRefusal(error={},version='0.2.0'){
  return {version,generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code:'UNKNOWN_FIELD',message:'column b.titel does not exist',position:8,hint:'Perhaps you meant "b.title".',sqlstate:'42703',candidates:['title'],...error}};
}
export function capiroDataCase(id=ids[1],{request=requests[id],version='0.2.0'}={}){
  const scene=billTextCase(),operation={id,version},contract=resolveOperationContract(operation),normalizationContext=request.source==='client_records'?{
    capiroDataScope:{clientId:request.clientId??null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}}:{};
  const {authority,state,now,wire}=scene;
  authority.decision.operation=`${id}@${version}`;authority.sourceIds=contract.descriptor.sourceRequirements.map(source=>source.sourceId);
  const page=request.source==='client_records'?privateCapiroDataPage(id,request.clientId??null):capiroDataPage(id),transport={...scene.transport,async fetchImpl(url,options){
    wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
    state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
  }};
  const call=()=>{const normalized=contract.normalizeInput(request,normalizationContext);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext,authority:readContext(authority)};};
  return {...scene,family:contract.binding.group,operation,contract,arguments:request,normalizationContext,transport,page,call,
    handler:changes=>{const config={...transport,now,...changes};if(config.credentialsForCall)delete config.getCredentials;return (version==='0.3.0'?createCapiroData3Handlers:createCapiroDataHandlers)(config,[operation])[0].execute;}};
}
