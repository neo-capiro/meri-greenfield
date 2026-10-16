/** Lane-owned family integration. Creates passive canonical handlers and measures their source manifests.
 * Neither registration nor measured bytes qualify a handler: the native installation receipt is still mandatory.
 * All transport/registry/clock/identity ports come from trusted startup; no ambient credentials or import-time I/O. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ownFields} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import * as f0 from './families/meeting-source.mjs';
import * as f1 from './families/action-items-complete.mjs';
import * as f2 from './families/operational-reads.mjs';
import * as f3 from './families/tenant-contacts.mjs';
import * as f4 from './families/entity-candidates.mjs';
import * as f5 from './families/client-knowledge-profile.mjs';
import * as f6 from './families/client-documents.mjs';
import * as f7 from './families/client-knowledge-memory.mjs';
import * as f8 from './families/client-knowledge-monday.mjs';
import * as f9 from './families/dataset-metadata.mjs';
import * as f10 from './families/memory-proposals.mjs';
import * as f11 from './families/research-portfolio-evidence.mjs';
import * as f12 from './families/research-portfolio.mjs';
import * as f13 from './families/florida-budget.mjs';
const modules=[f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13];
const byFamily=new Map(modules.map(f=>[f.id,f]));
export const GENERAL_READ_ADAPTER_FAMILIES=Object.freeze(modules.map(f=>f.id));
const SOURCE_PATHS=Object.freeze({
 "research-portfolio": [
  "apps/gateway/sources/research-portfolio/handler.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/retained-read-context.mjs"
 ],
 "florida-budget": [
  "apps/gateway/sources/florida-budget/handler.mjs",
  "apps/gateway/sources/florida-budget/projection.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/retained-read-context.mjs"
 ],
 "action-items": [
  "apps/gateway/sources/action-items/handler.mjs",
  "apps/gateway/sources/action-items/http-adapter.mjs",
  "apps/gateway/sources/action-items/projection.mjs",
  "apps/gateway/sources/action-items/request-context.mjs"
 ],
 "client-evidence": [
  "apps/gateway/sources/client-evidence/handler.mjs",
  "apps/gateway/sources/client-evidence/http-adapter.mjs",
  "apps/gateway/sources/client-evidence/request-context.mjs"
 ],
 "client-knowledge": [
  "apps/gateway/sources/client-knowledge/handler.mjs",
  "apps/gateway/sources/client-knowledge/http-adapter.mjs",
  "apps/gateway/sources/client-knowledge/memory-eligibility.mjs",
  "apps/gateway/sources/client-knowledge/monday-mapping.mjs",
  "apps/gateway/sources/client-knowledge/request-context.mjs"
 ],
 "dataset-metadata": [
  "apps/gateway/sources/dataset-metadata/handler.mjs"
 ],
 "identity-contacts": [
  "apps/gateway/sources/identity-contacts/handler.mjs",
  "apps/gateway/sources/identity-contacts/http-adapter.mjs",
  "apps/gateway/sources/identity-contacts/request-context.mjs"
 ],
 "meetings": [
  "apps/gateway/sources/meetings/handler.mjs",
  "apps/gateway/sources/meetings/http-adapter.mjs",
  "apps/gateway/sources/meetings/request-context.mjs"
 ],
 "memory-proposals": [
  "apps/gateway/sources/memory-proposals/handler.mjs",
  "apps/gateway/sources/memory-proposals/http-adapter.mjs",
  "apps/gateway/sources/memory-proposals/request-context.mjs"
 ],
 "original-tracking": [
  "apps/gateway/sources/original-tracking/handler.mjs",
  "apps/gateway/sources/original-tracking/http-adapter.mjs",
  "apps/gateway/sources/original-tracking/mount.mjs",
  "apps/gateway/sources/original-tracking/projection.mjs",
  "apps/gateway/sources/original-tracking/request-context.mjs"
 ],
 "research-portfolio-evidence": [
  "apps/gateway/sources/research-portfolio-evidence/handler.mjs",
  "apps/gateway/sources/research-portfolio-evidence/http-adapter.mjs",
  "apps/gateway/sources/research-portfolio-evidence/projection.mjs",
  "apps/gateway/sources/research-portfolio-evidence/request-context.mjs"
 ]
});
const COMMON=['apps/gateway/general-reads/integration.mjs','apps/gateway/general-reads/registration.mjs',
 'apps/gateway/sources/source-admission.mjs','apps/gateway/sources/json-response.mjs'];
const TRANSPORT_FIELDS=['origin','endpoints','getCredentials','delegatedTransport','fetchImpl','maxRequestMs','maxResponseBytes','readMemoryEligibility','registry'];
export async function createGeneralReadFamilyHandlers(configuration){
 const {families,now,newId}=ownFields(configuration,['families','now','newId']);
 if(typeof now!=='function'||typeof newId!=='function')deny('GATEWAY_CONFIGURATION');
 const configured=ownFields(families,[],GENERAL_READ_ADAPTER_FAMILIES),handlers=new Map();
 for(const [id,transport] of Object.entries(configured)){
  const family=byFamily.get(id),usesIds=['action-items-complete','operational-reads'].includes(id);
  const values=family.createHandlers({...ownFields(transport,[],TRANSPORT_FIELDS),now,...(usesIds?{newId}:{})});
  const labels=[...COMMON,`apps/gateway/general-reads/families/${id}.mjs`,...SOURCE_PATHS[family.sourceDirectory]];
  const sourceFiles=await Promise.all(labels.map(async label=>({label,sha256:createHash('sha256').update(await readFile(new URL(`../../../${label}`,import.meta.url))).digest('hex')})));
  for(const {operation,execute} of values){const key=`${operation.id}@${operation.version}`;
   if(handlers.has(key))deny('GATEWAY_CONFIGURATION');
   handlers.set(key,Object.freeze({execute,sourceFiles,sourceSha256:canonicalSha256(sourceFiles)}));
  }
 }
 return handlers;
}
