/** Validate Core's bounded public SQL wire. Core alone parses SQL and selects relations. */
import {snapshotOperationData} from './operation-contracts.mjs';

const fail=()=>{throw Error('Invalid Capiro data contract');};
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const unique=values=>new Set(values).size===values.length;
const sameSet=(a,b)=>a.length===b.length&&a.every(value=>b.includes(value));
const integer=/^-?(?:0|[1-9]\d*)$/u;
const decimal=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

function cell(column,value){
  if(value===null){if(!column.nullable)fail();return;}
  switch(column.type){
    case 'string':if(typeof value!=='string')fail();break;
    case 'integer':if(typeof value!=='string'||!integer.test(value))fail();break;
    case 'decimal':if(typeof value!=='string'||!decimal.test(value))fail();break;
    case 'boolean':if(typeof value!=='boolean')fail();break;
    case 'date':if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value)||!instant(value)||new Date(value).toISOString().slice(0,10)!==value)fail();break;
    case 'timestamp':if(!instant(value)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value))fail();break;
    default:fail();
  }
}

function describe(page,input){
  const names=page.relations.map(relation=>relation.name);
  if(!unique(names)||input.relations&&!sameSet(input.relations,names))fail();
  for(const relation of page.relations){
    const fields=relation.fields.map(field=>field.name);
    if(!unique(fields)||relation.primaryKey.some(name=>!fields.includes(name))||relation.freshness.field!==null&&!fields.includes(relation.freshness.field))fail();
    for(const join of relation.relationships){
      if(join.fields.length!==join.referencedFields.length||join.fields.some(name=>!fields.includes(name)))fail();
      const target=page.relations.find(item=>item.name===join.referencedRelation);
      if(target&&join.referencedFields.some(name=>!target.fields.some(field=>field.name===name)))fail();
    }
  }
}

function query(page,input){
  const limit=input.rowLimit??200,names=page.columns.map(column=>column.name);
  if(page.limits.rowLimit!==limit||page.rowCount!==page.rows.length||page.rowCount>limit||!unique(names))fail();
  if(page.rowLimitReached&&!page.byteTruncated&&page.rowCount!==limit)fail();
  if(page.coverage.sqlLimit!==null&&page.rowCount>page.coverage.sqlLimit)fail();
  const relations=page.coverage.relations.map(relation=>relation.name);
  if(!unique(relations)||!sameSet(relations,page.relationsUsed))fail();
  for(const row of page.rows){
    if(!sameSet(Object.keys(row),names))fail();
    for(const column of page.columns)cell(column,row[column.name]);
  }
}

export function createCapiroDataValidators({validateShape}){
  const definition=(id,output=false)=>{
    if(!['describe_capiro_data','query_capiro_data'].includes(id))fail();
    return `CapiroData${id==='describe_capiro_data'?'Describe':'Query'}${output?'Output':'Request'}`;
  };
  function normalizeInput(id,raw){
    const input=snapshotOperationData(raw);validateShape(definition(id),input);
    if(id==='query_capiro_data'&&(Buffer.byteLength(input.sql,'utf8')>16384||bytes(input.parameters)>32768||
      input.parameters.some(value=>typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER))))fail();
    return {input,metadata:{scope:'public_curated_relations',absenceEvidence:false}};
  }
  function assertOutput(id,raw,request){
    const {input}=normalizeInput(id,request),page=snapshotOperationData(raw);validateShape(definition(id,true),page);
    if(!instant(page.generatedAt)||bytes(page)>262144)fail();
    if(!page.ok)return page;
    if(id==='describe_capiro_data')describe(page,input);else query(page,input);
    return page;
  }
  return Object.freeze({normalizeInput,assertOutput});
}
