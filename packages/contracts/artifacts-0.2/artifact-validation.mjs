import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename} from './artifact-formats.mjs';
const fail = message => { throw new Error(message); };
const functions = new Set(['SUM','AVERAGE','MIN','MAX','COUNT','IF','ABS','ROUND']);
export const ARTIFACT_OPERATION_IDS = Object.freeze(['create_word','create_excel','create_powerpoint','run_analysis']);
export const artifactSchemaId = 'urn:meri:artifacts:0.2.0';
export function createArtifactValidators({validateShape,validatePublicShape,canonicalSha256}) {
  const snapshot = value => snapshotOperationData(value);
  function request(value) {
    const data=snapshot(value);validateShape('ArtifactRequest',data);
    const walk=value=>{if(typeof value==='string'&&!value.isWellFormed())fail('Malformed Unicode');if(value&&typeof value==='object')for(const child of Object.values(value))walk(child);};walk(data);
    if(Buffer.byteLength(JSON.stringify(data))>2*1024*1024)fail('Artifact request too large');
    const chart=value=>{if(value.series.some(series=>series.values.length!==value.categories.length))fail('Chart category/value count mismatch');};
    if(data.operation==='create_word'&&data.format!=='txt')for(const b of data.content.blocks){
      if(b.kind==='table'&&b.rows.some(r=>r.length!==b.rows[0].length))fail('Ragged document table');
      if(b.kind==='chart')chart(b.chart);
    }
    if(data.operation==='create_excel'){
      const names=new Set();for(const sheet of data.content.sheets){
        const key=sheet.name.toLowerCase();if(names.has(key)||/[\\/?*\[\]:]/.test(sheet.name)||sheet.name.startsWith("'")||sheet.name.endsWith("'"))fail('Invalid/duplicate sheet name');names.add(key);
        for(const row of sheet.rows)for(const cell of row){
          if(Object.hasOwn(cell,'formula')){
            if(Object.hasOwn(cell,'value'))fail('Formula and literal are distinct cells');
            for(const token of cell.formula.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))if(!functions.has(token[1].toUpperCase()))fail('Unsupported formula function');
          }
        }
        for(const c of sheet.charts??[])chart(c);
      }
    }
    if(data.operation==='create_powerpoint')for(const slide of data.content.slides){if(slide.chart)chart(slide.chart);if(slide.table?.some(row=>row.length!==slide.table[0].length))fail('Ragged slide table');}
    if(data.operation==='run_analysis'&&data.format==='zip'){
      const names=new Set();for(const table of data.content.tables){
        if(names.has(table.name)||new Set(table.columns).size!==table.columns.length||table.rows.some(row=>row.length!==table.columns.length))fail('Invalid analysis table');names.add(table.name);
      }
      if(!names.has(data.content.source))fail('Missing analysis source');
    }
    return data;
  }
  function context(value){
    const data=snapshot(value);validateShape('ArtifactContext',data);
    for(const scope of data.scopes)if(scope.tenantId!==data.binding.tenantId)fail('Cross-tenant artifact scope');
    const scopeHashes=new Set(data.scopes.map(canonicalSha256));if(scopeHashes.size!==data.scopes.length)fail('Duplicate scope');
    for(const evidence of data.evidence)if(evidence.scopes.some(scope=>!scopeHashes.has(canonicalSha256(scope))))fail('Evidence scope not admitted');
    const ids=new Set();for(const asset of data.assets){if(ids.has(asset.id))fail('Duplicate asset ID');ids.add(asset.id);if(asset.object.scopes.some(scope=>!scopeHashes.has(canonicalSha256(scope))))fail('Asset scope not admitted');}
    return data;
  }
  function version(value){const data=snapshot(value);validatePublicShape('ArtifactVersion',data);return data;}
  function object(value){const data=snapshot(value);validatePublicShape('ObjectReference',data);return data;}
  function inspection(value){const data=snapshot(value);validateShape('ArtifactInspection',data);return data;}
  function normalizeArtifactInput(id,value,options){
    if(typeof id!=='string'||!ARTIFACT_OPERATION_IDS.includes(id))fail('Unknown artifact operation');
    const input=request(value),ctx=context(options);if(input.operation!==id)fail('Artifact operation mismatch');
    if(input.format==='sandbox'){
      if(!ctx.analysisAdmission)fail('Trusted general-analysis admission binding required');
      const scopes=new Set(ctx.scopes.map(canonicalSha256));for(const source of [input.content.program,...input.content.inputs])if(source.scopes.some(s=>!scopes.has(canonicalSha256(s))))fail('Analysis source scope not admitted');
    }else if(ctx.analysisAdmission)fail('Irrelevant analysis admission');
    return {input,metadata:{requestSha256:canonicalSha256({request:input,context:ctx,baseVersionId:null}),sourceConnected:false,nativeQualified:false}};
  }
  function assertArtifactOutput(id,value,requestValue,options){
    const normalized=normalizeArtifactInput(id,requestValue,options),ctx=context(options),data=snapshot(value);validateShape('ArtifactOperationResult',data);
    if(normalized.input.format==='sandbox'){
      validateShape('GeneralAnalysisResult',data);
      const intent={...normalized.input.content,binding:ctx.binding,scopes:ctx.scopes,deadlineMs:ctx.deadlineMs,maxBytes:ctx.maxBytes};
      if(data.intentSha256!==canonicalSha256(intent)||data.admissionReceiptSha256!==ctx.analysisAdmission.receiptSha256||data.manifestSha256!==ctx.analysisAdmission.manifestSha256||data.imageDigest!==ctx.analysisAdmission.imageDigest)fail('General analysis output provenance');
      const names=normalized.input.content.outputs;if(data.outputs.length!==names.length||new Set(data.outputs.map(x=>x.name)).size!==names.length||data.outputs.some(x=>!names.includes(x.name)||canonicalSha256(x.object.scopes)!==canonicalSha256(ctx.scopes))||data.outputs.reduce((sum,x)=>sum+x.object.bytes,0)>ctx.maxBytes)fail('General analysis output objects');
    }else{
      validateShape('ArtifactCreatedResult',data);
      if(data.execution.requestSha256!==normalized.metadata.requestSha256||canonicalSha256(data.version.binding)!==canonicalSha256(ctx.binding)||canonicalSha256(data.version.scopes)!==canonicalSha256(ctx.scopes)||canonicalSha256(data.version.object.scopes)!==canonicalSha256(ctx.scopes)||canonicalSha256(data.version.evidence)!==canonicalSha256(ctx.evidence)||data.version.parentVersionId!==null||data.version.generationStatus!=='draft'||data.version.previewStatus!=='pending'||data.version.mimeType!==ARTIFACT_MIME_TYPES[normalized.input.format]||data.version.filename!==artifactFilename(normalized.input)||data.inspection.format!==normalized.input.format||data.version.object.sha256!==data.inspection.sha256||data.version.object.bytes!==data.inspection.bytes||data.inspection.bytes>ctx.maxBytes)fail('Artifact output provenance');
    }
    return data;
  }
  return Object.freeze({request,context,version,object,inspection,normalizeArtifactInput,assertArtifactOutput,snapshot,hash:canonicalSha256});
}
export function artifactInputDefinition(id){if(typeof id!=='string'||!ARTIFACT_OPERATION_IDS.includes(id))fail('Unknown artifact operation');return {create_word:'WordRequest',create_excel:'ExcelRequest',create_powerpoint:'PowerpointRequest',run_analysis:'AnalysisRequest'}[id];}
export function artifactOutputDefinition(id){if(typeof id!=='string'||!ARTIFACT_OPERATION_IDS.includes(id))fail('Unknown artifact operation');return id==='run_analysis'?'ArtifactOperationResult':'ArtifactCreatedResult';}
