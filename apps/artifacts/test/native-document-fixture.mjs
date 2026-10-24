/** Canonical intent and artifact owners over isolated scripted SQL/CAS. No database, provider or renderer qualification. */
import {nativePreparationsFixture} from './native-preparations-fixture.mjs';
import {createHash} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPostgresArtifactService} from '../postgres-service.mjs';
import {sqlFixture,record,NOW,id} from '../storage/test/sql-fixture.mjs';
import {publicationFixture} from '../storage/test/publication-fixture.mjs';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function nativeDocumentFixture({binding,scopes}={}){
 const sql=sqlFixture(),stored=record(),context={binding:binding??stored.version.binding,scopes:scopes??stored.version.scopes,evidence:[],assets:[],deadlineMs:NOW+60000,maxBytes:1048576};
 const publication=binding?publicationFixture(binding.tenantId,()=>NOW):sql.durable;
 const {pool,state}=nativePreparationsFixture();Object.assign(state,{clock:NOW,executions:[],puts:0,gets:0,denied:false,objects:new Map(),executorHook:null,putHook:null,authorizeHook:null});
 const objects={async put(x){state.puts++;await state.putHook?.(x);const o={objectId:x.objectId,versionId:'SYNTHETIC_'+x.objectId,sha256:sha(x.bytes),bytes:x.bytes.length,scopes:structuredClone(x.scopes)};state.objects.set(v.hash(o),Buffer.from(x.bytes));return o;},async get(o){state.gets++;const value=state.objects.get(v.hash(o));if(!value)throw Error('MISSING_OBJECT');return Buffer.from(value);}};
 const options={pool,context,validators:v,now:()=>state.clock,versions:sql.create({publication:publication.publication,tenantId:context.binding.tenantId}),objects,retention:sql.retention,
  async authorize(x){await state.authorizeHook?.(x);if(state.denied)throw Error('CURRENT_ACCESS_DENIED');return {receiptId:id(900),decision:'allow',action:x.action,binding:structuredClone(x.binding),scopesSha256:v.hash(x.scopes),resourceSha256:v.hash(x.resource),requestSha256:x.requestSha256,expiresAtMs:x.deadlineMs};},
  executor:{async execute(x){state.executions.push(x);await state.executorHook?.(x);const bytes=Buffer.from(x.request.content.text);return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}}};}}};
 const call={deliveryId:'native-delivery',baseVersionId:null,request:{operation:'create_word',format:'txt',title:'Synthetic',content:{text:'First version\n'}}};
 const owner=changes=>createPostgresArtifactService({...options,...changes});
 return {sql,publication,state,options,context,call,owner,run:(input=call,signal)=>owner().execute(input,signal)};
}
