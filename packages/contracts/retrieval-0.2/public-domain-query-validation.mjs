// Closed typed query/result contracts only. No SQL generation, database access,
// audit write, current grants or claim that query-role/runtime checks occurred.
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant} from './public-data-deadlines.mjs';
import {assertPublicDomainDatasetRegistry} from './public-domain-registry.mjs';

const ID='query_global_data', URN='urn:meri:retrieval:public-domain-query:0.2.0';
const fail=message=>{throw new Error(message);};
export const PUBLIC_DOMAIN_QUERY_OPERATION_IDS=Object.freeze([ID]);
const numericString=/^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|NaN|[+-]?Infinity)$/i;
const nullOps=new Set(['is_null','is_not_null']);
function freeze(value) {
  if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;
}
function inputValue(type,value) {
  if(type==='number'){if(typeof value!=='number'||!Number.isFinite(value))fail('Numeric filter value required');return value;}
  if(type==='boolean'){if(typeof value!=='boolean')fail('Boolean filter value required');return value;}
  if(typeof value!=='string')fail('String filter value required');
  if(type==='date'||type==='timestamp'){
    const at=Date.parse(value);if(!Number.isFinite(at))fail('Finite date filter value required');return new Date(at).toISOString();
  }
  return value; // string[] fields use scalar strings in the frozen filter contract.
}
function resultValue(type,value,aggregate) {
  if(aggregate==='count'||aggregate==='count_distinct'){
    if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return;
    if(typeof value==='string'&&/^[1-9]\d*$/.test(value)&&BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER))return;
    fail('Count must preserve a nonnegative safe integer or an unsafe integer string');
  }
  if(value===null)return; // Stored nulls and empty aggregate groups are not missing facts.
  if(type==='number'){
    if(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&numericString.test(value))return;
    fail('Numeric result must preserve the source numeric or decimal-string projection');
  }
  if(type==='boolean'){if(typeof value!=='boolean')fail('Boolean result required');return;}
  if(type==='string[]'){
    if(!Array.isArray(value)||value.some(x=>x!==null&&typeof x!=='string'))fail('Stored text-array result required');return;
  }
  if(typeof value!=='string')fail('Stored string result required');
  if(type==='date'||type==='timestamp')assertPublicDataInstant(value);
}
export function createPublicDomainQueryValidators({validateShape,schema,canonicalSha256,datasetRegistry}) {
  if(typeof validateShape!=='function'||typeof canonicalSha256!=='function'||schema?.$id!==URN)fail('Global query validator configuration');
  assertPublicDomainDatasetRegistry(datasetRegistry);
  const definitions=new Set(Object.keys(schema.$defs));
  const operation=id=>{if(id!==ID)fail('Unknown global query operation');};
  function publicDomainQueryInputDefinition(id){operation(id);return'PublicDomainQueryInput';}
  function publicDomainQueryOutputDefinition(id){operation(id);return'PublicDomainQueryOutput';}
  function validatePublicDomainQueryShape(name,value){
    if(typeof name!=='string'||!definitions.has(name))fail('Unknown global query definition');
    const data=snapshotOperationData(value);validateShape(name,data);return data;
  }
  function selection(id,request,options){
    operation(id);
    const raw=validatePublicDomainQueryShape('PublicDomainQueryRequest',request);
    const ctx=validatePublicDomainQueryShape('PublicDomainQueryContext',options);
    const snapshot=datasetRegistry.resolveDatasetSnapshot(raw.dataset);
    const {metadata,defaultLimit,maxLimit,snapshotSha256}=snapshot;
    if(canonicalSha256({metadata,defaultLimit,maxLimit})!==snapshotSha256)fail('Dataset snapshot changed');
    const fields=new Map(metadata.fields.map(field=>[field.name,field]));
    const field=name=>{if(!fields.has(name))fail('Unknown global dataset field');return fields.get(name);};
    const aliases=new Map(),ordinary=new Set();
    const select=raw.select.map(item=>{
      if(item.agg==='count'&&!item.field){
        if(aliases.has('count_all'))fail('Duplicate selected alias');aliases.set('count_all',{type:'number',agg:'count'});return{agg:'count'};
      }
      if(!item.field)fail('Selected field required');const meta=field(item.field);
      if(item.agg){
        if(!meta.groupable)fail('Field cannot be aggregated');
        if(['sum','avg'].includes(item.agg)&&meta.type!=='number')fail('Numeric aggregate requires numeric field');
      }else ordinary.add(item.field);
      const name=item.agg?`${item.agg}_${item.field}`:item.field;
      if(aliases.has(name))fail('Duplicate selected alias');aliases.set(name,{type:meta.type,agg:item.agg});return item;
    });
    const groupBy=raw.groupBy??[];
    for(const name of groupBy)if(!ordinary.has(name)||!field(name).groupable)fail('Group field must be groupable and ordinarily selected');
    if(select.some(item=>item.agg)&&[...ordinary].some(name=>!groupBy.includes(name)))fail('Mixed aggregate selection requires each ordinary field grouped');
    const filters=(raw.filters??[]).map(item=>{
      const meta=field(item.field);if(!meta.filterable)fail('Field cannot be filtered');
      if(nullOps.has(item.op))return{field:item.field,op:item.op};
      if(item.op==='contains'&&meta.type!=='string')fail('Contains filter requires text field');
      let value;
      if(['in','not_in','between'].includes(item.op)){
        if(!Array.isArray(item.value)||(item.op==='between'?item.value.length!==2:item.value.length<1||item.value.length>200))fail('Invalid filter value window');
        value=item.value.map(v=>inputValue(meta.type,v));
      }else value=inputValue(meta.type,item.value);
      return{field:item.field,op:item.op,value};
    });
    const orderBy=(raw.orderBy??[]).map(item=>{
      if(!aliases.has(item.field))fail('Ordering requires a selected alias');return{field:item.field,direction:item.direction==='desc'?'desc':'asc'};
    });
    const requested=raw.limit===undefined?defaultLimit:Number(raw.limit);
    if(!Number.isFinite(requested)||requested<1)fail('Positive finite query limit required');
    const limit=Math.min(Math.floor(requested),maxLimit);
    let asOfDate=null;
    if(metadata.supportsAsOf){
      if(raw.asOfDate===undefined){if(ctx.defaultAsOf===null)fail('Trusted default as-of observation required');assertPublicDataInstant(ctx.defaultAsOf);asOfDate=ctx.defaultAsOf;}
      else{if(ctx.defaultAsOf!==null)fail('Explicit as-of selector cannot use a default observation');const time=Date.parse(raw.asOfDate);if(!Number.isFinite(time))fail('Finite as-of selector required');asOfDate=new Date(time).toISOString();}
    }else if(raw.asOfDate!==undefined||ctx.defaultAsOf!==null)fail('Dataset does not use an as-of selector');
    const input={dataset:raw.dataset,select,filters,groupBy,orderBy,limit,asOfDate,snapshotSha256};
    validateShape('PublicDomainQueryInput',input);return{input,aliases};
  }
  function normalizePublicDomainQueryInput(id,request,options){
    const {input}=selection(id,request,options);
    return Object.freeze({input:freeze(input),metadata:Object.freeze({
      sourceConnected:false,queryAuthorized:false,producerQualified:false,absenceEvidence:false,
      auditWriteQualified:false,sqlExposed:false,registryProjectionSha256:datasetRegistry.projectionSha256,
    })});
  }
  function assertPublicDomainQueryOutput(id,value,request,options){
    const {input,aliases}=selection(id,request,options);
    const page=validatePublicDomainQueryShape(publicDomainQueryOutputDefinition(id),value);
    assertPublicDataInstant(page.generatedAt);
    if(Object.hasOwn(page,'ok'))return page; // Error never becomes an empty success or absence evidence.
    if(page.dataset!==input.dataset||page.rowCount>input.limit||page.rowCount<page.rows.length)fail('Global query dataset/count window mismatch');
    const truncated=page.rows.length<page.rowCount;
    if(Object.hasOwn(page,'truncated')!==truncated||Object.hasOwn(page,'note')!==truncated)fail('Global row truncation disclosure mismatch');
    if(truncated&&page.note!==`Only the first ${page.rows.length} of ${page.rowCount} rows are shown; add filters, group, or lower limit to see the rest.`)fail('Global truncation note mismatch');
    let used=2;
    for(const row of page.rows){
      if(Object.keys(row).length!==aliases.size||[...aliases.keys()].some(name=>!Object.hasOwn(row,name)))fail('Global result aliases differ from selected projection');
      for(const [name,meta]of aliases)resultValue(meta.type,row[name],meta.agg);
      used+=JSON.stringify(row).length+1;if(used>256*1024)fail('Global result exceeds whole-row UTF-16 budget');
    }
    // This checks the returned bounded projection, not omitted row bytes, actual
    // SQL execution/order/corpus count, audit persistence, grants or snapshot truth.
    return page;
  }
  return Object.freeze({publicDomainQuerySchemaId:URN,PUBLIC_DOMAIN_QUERY_OPERATION_IDS,
    publicDomainQueryInputDefinition,publicDomainQueryOutputDefinition,validatePublicDomainQueryShape,
    normalizePublicDomainQueryInput,assertPublicDomainQueryOutput});
}
