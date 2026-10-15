/** The canonical artifact service over scripted in-memory ports and a plain-text executor.
 * Same pattern as apps/artifacts/test/artifact-service-independent.test.mjs; no S3, PostgreSQL, Office or Python process. */
import {createHash} from 'node:crypto';
import {createArtifactService} from '../../apps/artifacts/service.mjs';
import {artifactValidators as validators} from '../../packages/contracts/retrieval-0.2/validate.mjs';
import {syntheticId} from './conversation-application.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createScriptedArtifactService({now=Date.now,deadlineMs=5000}={}){
 let sequence=1;const records=new Map(),heads=new Map(),objects=new Map(),events=[];
 const ports={validators,now,ids:()=>({artifactId:syntheticId('aaaa',sequence++),versionId:syntheticId('aaaa',sequence++),objectId:syntheticId('aaaa',sequence++)}),
  async authorize(x){events.push({stage:'authorize',action:x.action});return {receiptId:'scripted-receipt',decision:'allow',action:x.action,binding:structuredClone(x.binding),scopesSha256:validators.hash(x.scopes),resourceSha256:validators.hash(x.resource),requestSha256:x.requestSha256,expiresAtMs:x.deadlineMs};},
  budget:{async reserve(x){events.push({stage:'reserve'});return {ticketId:'scripted-ticket',binding:x.binding,requestSha256:x.requestSha256,maxBytes:x.maxBytes,deadlineMs:x.deadlineMs};},
   async settle(x){events.push({stage:'settle',outcome:x.outcome});return {ticketId:x.ticketId,requestSha256:x.requestSha256,bytes:x.bytes,outcome:x.outcome,status:'settled'};}},
  objects:{async put(x){events.push({stage:'put'});const o={objectId:x.objectId,versionId:'scripted-'+sha(x.bytes),sha256:sha(x.bytes),bytes:x.bytes.length,scopes:structuredClone(x.scopes)};objects.set(validators.hash(o),Buffer.from(x.bytes));return o;},
   async get(o){events.push({stage:'get'});const bytes=objects.get(validators.hash(o));if(!bytes)throw Object.assign(Error('ARTIFACT_OBJECT_MISSING'),{code:'ARTIFACT_OBJECT_MISSING'});return Buffer.from(bytes);}},
  versions:{async read(versionId){events.push({stage:'read'});return structuredClone(records.get(versionId));},
   async commit(x){events.push({stage:'commit'});if((heads.get(x.version.artifactId)??null)!==x.expectedParentVersionId)throw Object.assign(Error('STALE'),{code:'STALE'});
    records.set(x.version.versionId,structuredClone({version:x.version,spec:x.spec,specSha256:x.specSha256,requestSha256:x.requestSha256,inspection:x.inspection}));heads.set(x.version.artifactId,x.version.versionId);
    return {status:'committed',versionId:x.version.versionId,requestSha256:x.requestSha256,versionSha256:validators.hash(x.version)};}},
  executor:{async execute({request}){events.push({stage:'execute'});if(request.format!=='txt')throw Object.assign(Error('SCRIPTED_EXECUTOR_TXT_ONLY'),{code:'SCRIPTED_EXECUTOR_TXT_ONLY'});const bytes=Buffer.from(request.content.text);
   return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}}};}}};
 const service=createArtifactService(ports);
 const context=({binding,scopes})=>({binding:structuredClone(binding),scopes:structuredClone(scopes),evidence:[],assets:[],deadlineMs:now()+deadlineMs,maxBytes:1048576});
 const textRequest=(title,text)=>({operation:'create_word',format:'txt',title,content:{text}});
 return Object.freeze({service,records,events,context,textRequest});
}
