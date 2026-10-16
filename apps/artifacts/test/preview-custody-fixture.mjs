/** Synthetic conditional evidence + scripted SQL only. No database/provider/storage process; not native durability evidence. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {v,sha} from '../storage/boundary.mjs';import {record} from '../storage/test/sql-fixture.mjs';
import {realPdf} from './pdf-fixtures.mjs';import {previewClaim} from '../preview/claim.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createPreviewCustodyJournal} from '../preview/custody-journal.mjs';import {createPostgresPreviewStore} from '../preview/postgres-store.mjs';
import {createArtifactPreviewService} from '../preview/service.mjs';import {createPreviewCustodyRecovery} from '../preview/custody-recovery.mjs';
export function custodyFixture(){const currentMs=Date.now();
 const source=record(),bytes=realPdf(['synthetic durable preview']);source.spec={operation:'create_word',format:'pdf',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'synthetic durable preview'}]}]}};
 source.specSha256=v.hash(source.spec);Object.assign(source.version,{filename:'Synthetic.pdf',mimeType:'application/pdf'});Object.assign(source.version.object,{sha256:sha(bytes),bytes:bytes.length});
 Object.assign(source.inspection,{format:'pdf',sha256:sha(bytes),bytes:bytes.length,details:{conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:'1'.repeat(64)}});
 const version=source.version,context=v.context({binding:version.binding,scopes:version.scopes,evidence:[],assets:[],maxBytes:8388608,deadlineMs:currentMs+60000}),claim=previewClaim(v,version,{objectId:randomUUID(),versionId:randomUUID()},context,new Date(currentMs).toISOString());
 const state={rows:new Map(),facts:new Map(),allocations:new Map(),calls:[],leases:[],puts:0,objectBytes:new Map(),lostFact:null,lostSql:null,deny:false,now:currentMs,hook:null,readHook:null,sourceRecoveries:0};
 const clone=structuredClone;
 function ack(request,created,value=request.value){const entrySha256=v.hash(value),receiptSha256=v.hash({namespace:request.namespace,key:request.key,entrySha256});return {created,value:clone(value),entrySha256,receiptSha256};}
 const evidence={async claim(request){state.calls.push({kind:'claim',request:clone(request)});const old=state.facts.get(request.key);if(old)return ack(request,false,old.value);
   if(state.allocations.has(request.allocationKey))throw Error('synthetic allocation conflict');state.allocations.set(request.allocationKey,request.sourceKey);
   const result=ack(request,true);state.facts.set(request.key,{value:clone(result.value),entrySha256:result.entrySha256,receiptSha256:result.receiptSha256});
   if(state.lostFact==='CLAIMED'){state.lostFact=null;throw Error('synthetic durable CLAIMED ACK lost');}return result;},
  async append(request){state.calls.push({kind:'append',request:clone(request)});const old=state.facts.get(request.key);if(old)return ack(request,false,old.value);const result=ack(request,true);
   state.facts.set(request.key,{value:clone(result.value),entrySha256:result.entrySha256,receiptSha256:result.receiptSha256});if(state.lostFact===request.value.state){state.lostFact=null;throw Error('synthetic durable '+request.value.state+' ACK lost');}return result;},
  async read(){state.calls.push({kind:'read'});if(state.readHook)await state.readHook();return [...state.facts.values()].map(value=>clone(value));}};
 const pool={async connect(){const lease={queries:[],releases:[],writeKind:null,async query(sql,args=[]){lease.queries.push({sql,args:clone(args)});if(state.hook)await state.hook(sql,args);
    if(sql==='COMMIT'&&state.lostSql===lease.writeKind&&lease.writeKind){state.lostSql=null;throw Error('synthetic SQL COMMIT ACK lost');}
    if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}],rowCount:1};
    if(sql.startsWith('BEGIN')||sql.startsWith('SET ')||sql.startsWith('SELECT pg_advisory')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[],rowCount:0};
    if(sql.startsWith('SELECT a.*,p.record'))return {rows:[...state.rows.values()].map(value=>clone(value)).sort((a,b)=>a.version_id.localeCompare(b.version_id)),rowCount:state.rows.size};
    if(sql.startsWith('INSERT INTO meri_artifacts.preview_attempts')){lease.writeKind='CLAIMED';if(state.rows.has(args[3]))return {rows:[],rowCount:0};
     const [tenant_id,conversation_id,artifact_id,version_id,source_version_sha256,source_sha256,preview_id,object_id,claim,claim_sha256]=clone(args);
     state.rows.set(version_id,{tenant_id,conversation_id,artifact_id,version_id,source_version_sha256,source_sha256,preview_id,object_id,claim,claim_sha256,object_reference:null,object_reference_sha256:null,object_version_id:null,record:null,record_sha256:null});return {rows:[],rowCount:1};}
    if(sql.startsWith('UPDATE meri_artifacts.preview_attempts')){lease.writeKind='OBJECT_RECORDED';const row=state.rows.get(args[1]);if(!row||row.claim_sha256!==args[5]||row.object_reference!==null)return {rows:[],rowCount:0};
     Object.assign(row,{object_reference:clone(args[2]),object_reference_sha256:args[3],object_version_id:args[4]});return {rows:[],rowCount:1};}
    if(sql.startsWith('INSERT INTO meri_artifacts.previews')){lease.writeKind='COMMITTED';const row=state.rows.get(args[3]);assert.ok(row?.object_reference,'receipt before publication');if(row.record)return {rows:[],rowCount:0};Object.assign(row,{record:clone(args[9]),record_sha256:args[10]});return {rows:[],rowCount:1};}
    if(sql.startsWith('SELECT claim,')||sql.startsWith('SELECT object_reference,')||sql.startsWith('SELECT record,')){const row=state.rows.get(args[1]);return {rows:row?[clone(row)]:[],rowCount:row?1:0};}
    throw Error('Unexpected synthetic SQL: '+sql);
   },release(error){lease.releases.push(error);}};state.leases.push(lease);return lease;}};
 const now=()=>state.now,journal=createPostgresRetentionJournal({pool,now,maxRequestMs:100}),versions={async read(id){if(id!==version.versionId)throw Error('synthetic absent source');return clone(source);}};
 const durable=()=>createPreviewCustodyJournal({evidence,tenantId:version.binding.tenantId,artifactId:version.artifactId,now,maxRequestMs:100});
 const create=()=>createPostgresPreviewStore({journal,versions,custodyJournal:durable(),tenantId:version.binding.tenantId,artifactId:version.artifactId,now,maxRequestMs:200});
 const sourceRecovery={async recover(value){assert.deepEqual(value,source);state.sourceRecoveries++;}},store=create();
 const recovery=()=>createPreviewCustodyRecovery({store:create(),sourceRecovery,now,maxRequestMs:500});
 const artifacts={async download(){if(state.deny)throw Error('synthetic revoked');return {version:clone(version),bytes:Buffer.from(bytes)};},async inspect(){if(state.deny)throw Error('synthetic revoked');return {version:clone(version)};}};
 const objects={async put(value){state.puts++;const object={objectId:value.objectId,versionId:'synthetic-native-'+state.puts,sha256:sha(value.bytes),bytes:value.bytes.length,scopes:value.scopes};state.objectBytes.set(object.versionId,Buffer.from(value.bytes));return object;},async get(object){return Buffer.from(state.objectBytes.get(object.versionId));}};
 const service=(previewStore=store,objectPort=objects)=>createArtifactPreviewService({validators:v,artifacts,objects:objectPort,previews:previewStore,ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now});
 return {source,version,bytes,context,claim,state,evidence,journal,store,create,durable,recovery,objects,service,sourceRecovery,
  recover:()=>journal.exclusive(()=>recovery().reconcileExclusive()),publish:(previewStore=store,objectPort=objects)=>service(previewStore,objectPort).publish(version.versionId,context)};
}
