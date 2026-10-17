/** Lane-owned family integration. Creates passive canonical handlers and measures their source manifests.
 * Neither registration nor measured bytes qualify a handler: the native installation receipt is still mandatory.
 * All transport/registry/clock/identity ports come from trusted startup; no ambient credentials or import-time I/O. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ownFields} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {assertFamilyHandlerSet} from './registration.mjs';
import {NATIVE_READ_FAMILIES} from '../sources/retained-reads/native-families.mjs';
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
import * as f14 from './families/bill-text.mjs';
import * as f15 from './families/public-reports.mjs';
import * as f16 from './families/acquisition-personnel.mjs';
import * as f17 from './families/disclosures.mjs';
import * as f18 from './families/legislative-directory.mjs';
import * as f19 from './families/pe-references.mjs';
import * as f20 from './families/federal-legislation.mjs';
import * as f21 from './families/state-legislation.mjs';
import * as f22 from './families/stored-intelligence.mjs';
import * as f23 from './families/regulatory-dockets.mjs';
import * as f24 from './families/intelligence-summary.mjs';
import * as f25 from './families/public-web.mjs';
import * as f26 from './families/data-search.mjs';
import * as f27 from './families/public-domain-query.mjs';
import * as f28 from './families/facility-representation.mjs';
import * as f29 from './families/district-nexus.mjs';
import * as f30 from './families/client-registry.mjs';
import * as f31 from './families/federal-market.mjs';
import * as f32 from './families/public-data.mjs';
import * as f33 from './families/client-knowledge-search.mjs';
import * as f34 from './families/state-status-votes.mjs';
import * as f35 from './families/tracked-bills.mjs';
import * as f36 from './families/public-domain-hearings.mjs';
import * as f37 from './families/research-legal-legislation.mjs';
import * as f38 from './families/research-legal-news.mjs';
import * as f39 from './families/outreach-query.mjs';
import * as f40 from './families/business-development.mjs';
import * as f41 from './families/funding-opportunities.mjs';
const modules=[f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f41];
const byFamily=new Map(modules.map(f=>[f.id,f]));
export const GENERAL_READ_ADAPTER_FAMILIES=Object.freeze(modules.map(f=>f.id));
const STORED_NATIVE_SOURCE_PATHS=Object.freeze([
 'apps/gateway/sources/retained-reads/native-handler.mjs',
 'apps/gateway/sources/retained-reads/call-context.mjs',
 'apps/gateway/sources/retained-reads/http-transport.mjs',
 'apps/gateway/dispatch/native-read-context.mjs',
 'apps/runtime/native-authority/native-read-credentials/core-client.mjs',
 'apps/runtime/native-authority/native-read-credentials/owner.mjs',
 'apps/gateway/dispatch/operation-context.mjs',
 'apps/gateway/dispatch/read-result-envelope.mjs',
 'apps/gateway/dispatch/tool-dispatch.mjs',
]);
const SOURCE_PATHS=Object.freeze({
 'funding-opportunities':['apps/gateway/sources/funding-opportunities/handler.mjs','apps/gateway/sources/funding-opportunities/request-context.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'public-data':['apps/gateway/sources/public-data/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'client-knowledge-search':['apps/gateway/sources/client-knowledge-search/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'state-status-votes':['apps/gateway/sources/state-status-votes/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'tracked-bills':['apps/gateway/sources/tracked-bills/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'public-domain-hearings':['apps/gateway/sources/public-domain-hearings/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'research-legal-legislation':['apps/gateway/sources/research-legal-legislation/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'research-legal-news':['apps/gateway/sources/research-legal-news/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'outreach-query':['apps/gateway/sources/outreach-query/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'business-development':['apps/gateway/sources/business-development/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'public-web':['apps/gateway/sources/public-web/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'data-search':['apps/gateway/sources/data-search/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'public-domain-query':['apps/gateway/sources/public-domain-query/handler.mjs','apps/gateway/sources/public-domain-query/native-result.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'facility-representation':['apps/gateway/sources/facility-representation/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'district-nexus':['apps/gateway/sources/district-nexus/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'client-registry':['apps/gateway/sources/client-registry/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'federal-market':['apps/gateway/sources/federal-market/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'pe-references':['apps/gateway/sources/pe-references/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'federal-legislation':['apps/gateway/sources/federal-legislation/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'state-legislation':['apps/gateway/sources/state-legislation/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'stored-intelligence':['apps/gateway/sources/stored-intelligence/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'regulatory-dockets':['apps/gateway/sources/regulatory-dockets/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 'intelligence-summary':['apps/gateway/sources/intelligence-summary/handler.mjs',...STORED_NATIVE_SOURCE_PATHS],
 "legislative-directory": [
  "apps/gateway/sources/legislative-directory/handler.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/native-read-context.mjs",
  "apps/runtime/native-authority/native-read-credentials/core-client.mjs",
  "apps/runtime/native-authority/native-read-credentials/owner.mjs",
  "apps/gateway/dispatch/operation-context.mjs",
  "apps/gateway/dispatch/read-result-envelope.mjs",
  "apps/gateway/dispatch/tool-dispatch.mjs"
 ],
 "disclosures": [
  "apps/gateway/sources/disclosures/handler.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/native-read-context.mjs",
  "apps/runtime/native-authority/native-read-credentials/core-client.mjs",
  "apps/runtime/native-authority/native-read-credentials/owner.mjs",
  "apps/gateway/dispatch/operation-context.mjs",
  "apps/gateway/dispatch/read-result-envelope.mjs",
  "apps/gateway/dispatch/tool-dispatch.mjs"
 ],
 "public-reports": [
  "apps/gateway/sources/public-reports/handler.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/native-read-context.mjs",
  "apps/runtime/native-authority/native-read-credentials/core-client.mjs",
  "apps/runtime/native-authority/native-read-credentials/owner.mjs",
  "apps/gateway/dispatch/operation-context.mjs",
  "apps/gateway/dispatch/read-result-envelope.mjs",
  "apps/gateway/dispatch/tool-dispatch.mjs"
 ],
 "acquisition-personnel": [
  "apps/gateway/sources/acquisition-personnel/handler.mjs",
  "apps/gateway/sources/acquisition-personnel/request-context.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/native-read-context.mjs",
  "apps/runtime/native-authority/native-read-credentials/core-client.mjs",
  "apps/runtime/native-authority/native-read-credentials/owner.mjs",
  "apps/gateway/dispatch/operation-context.mjs",
  "apps/gateway/dispatch/read-result-envelope.mjs",
  "apps/gateway/dispatch/tool-dispatch.mjs"
 ],
 "bill-text": [
  "apps/gateway/sources/bill-text/handler.mjs",
  "apps/gateway/sources/retained-reads/call-context.mjs",
  "apps/gateway/sources/retained-reads/http-transport.mjs",
  "apps/gateway/dispatch/bill-text-context.mjs",
  "apps/gateway/dispatch/native-read-context.mjs",
  "apps/runtime/native-authority/native-read-credentials/core-client.mjs",
  "apps/runtime/native-authority/native-read-credentials/owner.mjs",
  "apps/gateway/dispatch/operation-context.mjs",
  "apps/gateway/dispatch/read-result-envelope.mjs",
  "apps/gateway/dispatch/tool-dispatch.mjs"
 ],
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
 'apps/gateway/sources/retained-reads/native-families.mjs',
 'apps/gateway/sources/source-admission.mjs','apps/gateway/sources/json-response.mjs',
 // The integration module statically imports the new family, including its private wire, for every composition.
 'apps/gateway/general-reads/families/funding-opportunities.mjs',
 'apps/gateway/sources/funding-opportunities/handler.mjs','apps/gateway/sources/funding-opportunities/request-context.mjs',
 'packages/contracts/native-read-observation-0.2/schema.json','packages/contracts/native-read-observation-0.2/validate.mjs'];
const TRANSPORT_FIELDS=['origin','endpoints','getCredentials','credentialsForCall','authorizeResultForCall','delegatedTransport','fetchImpl','maxRequestMs','maxResponseBytes','readMemoryEligibility','registry'];
export async function createGeneralReadFamilyHandlers(configuration){
 const {families,now,newId}=ownFields(configuration,['families','now','newId']);
 if(typeof now!=='function'||typeof newId!=='function')deny('GATEWAY_CONFIGURATION');
 const configured=ownFields(families,[],GENERAL_READ_ADAPTER_FAMILIES),handlers=new Map();
 for(const [id,transport] of Object.entries(configured)){
  const family=byFamily.get(id),usesIds=['action-items-complete','operational-reads'].includes(id);
  const values=assertFamilyHandlerSet(id,family.createHandlers({...ownFields(transport,[],TRANSPORT_FIELDS),now,...(usesIds?{newId}:{})}));
  const labels=[...COMMON,`apps/gateway/general-reads/families/${id}.mjs`,...SOURCE_PATHS[family.sourceDirectory],...(NATIVE_READ_FAMILIES.includes(id)?['apps/runtime/native-authority/native-read-credentials/source-read-context.mjs','apps/runtime/native-authority/native-read-credentials/conversation-authority.mjs','apps/gateway/sources/public-domain-hearings/request-context.mjs','apps/gateway/sources/research-legal-legislation/request-context.mjs','apps/gateway/sources/research-legal-news/request-context.mjs','apps/gateway/sources/outreach-query/request-context.mjs','apps/gateway/sources/state-status-votes/request-context.mjs','apps/gateway/sources/business-development/request-context.mjs']:[])];
  const sourceFiles=await Promise.all([...new Set(labels)].map(async label=>({label,sha256:createHash('sha256').update(await readFile(new URL(`../../../${label}`,import.meta.url))).digest('hex')})));
  for(const {operation,execute} of values){const key=`${operation.id}@${operation.version}`;
   if(handlers.has(key))deny('GATEWAY_CONFIGURATION');
   handlers.set(key,Object.freeze({execute,sourceFiles,sourceSha256:canonicalSha256(sourceFiles)}));
  }
 }
 return handlers;
}
