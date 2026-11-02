/** Synthetic Core envelopes; no database, provider or live source qualification. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createCapiroDataHandlers,createCapiroData3Handlers,createCapiroData4Handlers,createCapiroData5Handlers} from '../handler.mjs';
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
/** Unified Agenda-like topics by OMB agency code; with the qualifiers below every one of up to 270 forecasts has its own title. */
const FORECAST_TOPICS=[['0938','Medicare Hospital Outpatient Prospective Payment Systems'],['0938','Medicaid Managed Care Access Standards'],['2060','National Emission Standards for Hazardous Air Pollutants: Chemical Manufacturing'],['2060','Renewable Fuel Standard Program Volumes'],['2040','Lead and Copper Rule Improvements'],['1218','Occupational Exposure to Respirable Crystalline Silica'],['1218','Heat Injury and Illness Prevention in Outdoor and Indoor Work Settings'],['2120','Airworthiness Standards for Unmanned Aircraft Systems'],['2120','Air Traffic Controller Training Requirements'],['0750','DFARS: Cybersecurity Maturity Model Certification'],['0750','DFARS: Domestic Content Requirements for Critical Components'],['1545','Section 45Y Clean Electricity Production Credit'],['1545','Section 48E Clean Electricity Investment Credit'],['3235','Disclosure of Order Execution Information'],['3235','Climate-Related Disclosures for Investors'],['1810','Student Assistance General Provisions'],['1840','Borrower Defense to Repayment'],['0648','Endangered Species: Designation of Critical Habitat for the North Atlantic Right Whale'],['0694','Export Administration Regulations: Advanced Computing Items'],['1625','Maritime Security: Cybersecurity in the Marine Transportation System'],['1651','Customs Modernization: Entry of Low-Value Shipments'],['1904','Energy Conservation Standards for Residential Furnaces'],['1904','Energy Conservation Standards for Commercial Refrigeration Equipment'],['3060','Broadband Data Collection Updates'],['3150','Licensing Framework for Advanced Nuclear Reactors'],['0581','Organic Livestock and Poultry Standards'],['0584','Supplemental Nutrition Assistance Program: Work Requirements'],['1205','Employee Retirement Income Security Act: Fiduciary Rule'],['2502','Manufactured Housing Construction and Safety Standards'],['9000','Federal Acquisition Regulation: Pay Equity and Transparency']];
const FORECAST_QUALIFIERS=['','Revisions to ','Amendments to ','Modernization of ','Updates to ','Clarification of ','Streamlining of ','Reporting Requirements for ','Technical Corrections to '];
/** A query result as Core returns `SELECT * FROM government_forecasts` (the published view's fourteen columns, 20281102150000):
 * `rows` forecasts with windows over the coming three quarters (every eleventh undated), checked at one source check. */
export function governmentForecastsPage(rows=250,{rowLimit=1000,checkedAt='2026-11-02 09:31:07.412+00'}={}){
  const text={type:'string',pgType:'text',nullable:true},column=(name,type=text)=>({name,...type});
  const columns=[column('forecast_id',{...text,nullable:false}),column('rin',{...text,nullable:false}),column('title'),column('event_type'),column('status',{...text,nullable:false}),
    column('window_from',{type:'date',pgType:'date',nullable:true}),column('window_to',{type:'date',pgType:'date',nullable:true}),column('period_precision'),column('period_text'),column('edition'),column('source_url'),
    column('revision',{type:'integer',pgType:'integer',nullable:false}),column('observed_at',{type:'timestamp',pgType:'timestamp with time zone',nullable:true}),column('recorded_at',{type:'timestamp',pgType:'timestamp with time zone',nullable:false})];
  const all=Array.from({length:rows},(_,i)=>{
    const [agency,topic]=FORECAST_TOPICS[i%FORECAST_TOPICS.length],rin=`${agency}-A${String.fromCharCode(65+(i%26))}${String(10+i%90).padStart(2,'0')}`;
    const month=11+i%9,year=2026+Math.floor((month-1)/12),m=((month-1)%12)+1,next=m===12?[year+1,1]:[year,m+1],dated=i%11!==10;
    return {forecast_id:(i.toString(16).padStart(8,'0')+'c0ffee').repeat(5).slice(0,64).padEnd(64,'0'),rin,title:`${FORECAST_QUALIFIERS[Math.floor(i/FORECAST_TOPICS.length)%FORECAST_QUALIFIERS.length]}${topic}`,
      event_type:i%3?'proposed_rule':'final_rule',status:'published',window_from:dated?`${year}-${String(m).padStart(2,'0')}-01`:null,window_to:dated?`${next[0]}-${String(next[1]).padStart(2,'0')}-01`:null,
      period_precision:dated?'month':'unknown',period_text:dated?`${String(m).padStart(2,'0')}/00/${year}`:'To Be Determined',edition:'202604',
      source_url:`https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202604&RIN=${rin}`,revision:1+i%3,observed_at:checkedAt,recorded_at:'2026-10-30 09:30:55.118+00'};
  });
  return {version:'0.2.0',generatedAt:'2026-11-02T14:25:00.000Z',ok:true,columns,rows:all.slice(0,rowLimit),rowCount:Math.min(rows,rowLimit),relationsUsed:['government_forecasts'],rowLimitReached:rows>rowLimit,byteTruncated:false,
    coverage:{basis:'query_bounded',sourceUniverseComplete:false,sqlLimit:null,relations:[{name:'government_forecasts',sourceAsOf:null,sourceVersion:null,limitations:['Published metadata does not establish active grants, populated rows, ingestion completeness or source freshness.','Only the forecasts Capiro synchronized from the Unified Agenda editions it checked; a missing forecast is absence within this ingestion, not on reginfo.gov.']}]},
    limits:{rowLimit,maxOutputBytes:262144}};
}
/** A Core 362 refusal carrying PostgreSQL's own diagnostics for the model's SQL. */
export function sqlRefusal(error={},version='0.2.0'){
  return {version,generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code:'UNKNOWN_FIELD',message:'column b.titel does not exist',position:8,hint:'Perhaps you meant "b.title".',sqlstate:'42703',candidates:['title'],...error}};
}
export function capiroDataCase(id=ids[1],{request=requests[id],version='0.2.0',context}={}){
  const scene=billTextCase(),operation={id,version},contract=resolveOperationContract(operation),normalizationContext=context??(request.source==='client_records'?{
    capiroDataScope:{clientId:request.clientId??null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}}:{});
  const {authority,state,now,wire}=scene;
  authority.decision.operation=`${id}@${version}`;authority.sourceIds=contract.descriptor.sourceRequirements.map(source=>source.sourceId);
  const page=request.source==='client_records'?privateCapiroDataPage(id,request.clientId??null):capiroDataPage(id),transport={...scene.transport,async fetchImpl(url,options){
    wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
    state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
  }};
  const call=()=>{const normalized=contract.normalizeInput(request,normalizationContext);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext,authority:readContext(authority)};};
  return {...scene,family:contract.binding.group,operation,contract,arguments:request,normalizationContext,transport,page,call,
    handler:changes=>{const config={...transport,now,...changes};if(config.credentialsForCall)delete config.getCredentials;return (version==='0.5.0'?createCapiroData5Handlers:version==='0.4.0'?createCapiroData4Handlers:version==='0.3.0'?createCapiroData3Handlers:createCapiroDataHandlers)(config,[operation])[0].execute;}};
}
