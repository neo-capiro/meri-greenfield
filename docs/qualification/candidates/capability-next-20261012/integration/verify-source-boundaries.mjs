/** Exact source ledger/preservation audit; no external/native work. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertCatalog} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const base='4cdabab9ae3ef5f44e2a1eb10ae1a8a6622fa640';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const raw=path=>readFileSync(new URL(`../../../../../${path}`,import.meta.url));
const parse=path=>JSON.parse(raw(path));
const path='packages/contracts/retrieval-0.2/catalog.json';
const original=JSON.parse(git('show',`${base}:${path}`)), catalog=assertCatalog(parse(path));
const additions=['lookup_client_registry','get_business_development_context','get_business_development_evidence',
 'get_business_development_recent_changes','get_research_portfolio','get_research_portfolio_changes'];
assert.equal(catalog.originals.length,139);
assert.equal(catalog.originals.filter(row=>row.disposition==='selected').length,96);
assert.equal(catalog.originals.filter(row=>row.disposition==='deferred').length,43);
assert.equal(catalog.originals.filter(row=>row.state==='mapped').length,20);
assert.equal(catalog.originals.filter(row=>row.disposition==='selected'&&row.state==='pending').length,76);
assert.equal(catalog.operations.length,21);
for(const [index,previous] of original.originals.entries()){
 const expected=structuredClone(previous);
 if(additions.includes(previous.id)){expected.state='mapped';expected.replacement={id:previous.id,version:'0.2.0'};}
 assert.deepEqual(catalog.originals[index],expected);
}
for(const previous of original.operations) assert.deepEqual(catalog.operations.find(row=>row.operation.id===previous.operation.id),previous);
for(const operation of catalog.operations){
 assert.equal(operation.handler,null);assert.equal(operation.availability,'unimplemented');assert.equal(operation.qualification,'pending');
 assert.equal(operation.retry.maxRetries,0);assert.deepEqual(operation.retry.retryableCodes,[]);
}
for(const id of ['query_action_items','get_research_evidence']){
 const row=catalog.originals.find(row=>row.id===id);assert.equal(row.state,'pending');assert.equal(row.replacement,null);
}
const protectedPaths=['apps/proxy','apps/worker','apps/control','apps/gateway/dispatch','apps/gateway/authorization',
 'apps/gateway/catalog','apps/gateway/index.mjs','scripts','infra','package.json','package-lock.json',
 'packages/contracts/package.json','packages/contracts/package-lock.json','packages/contracts/dist',
 'packages/contracts/meri.schema.json','packages/contracts/validate.mjs','docs/CAPABILITIES.json',
 'docs/CAPABILITY-SCOPE.md','docs/coordination/r2','docs/plans'];
assert.equal(git('diff','--name-only',base,'--',...protectedPaths),'');
const oldSchemas=git('ls-tree','-r','--name-only',base,'packages/contracts/retrieval-0.2').split('\n').filter(x=>x.endsWith('.schema.json'));
assert.equal(git('diff','--name-only',base,'--',...oldSchemas),'');
assert.equal(git('rev-parse','release/meri-rc1-20261012'),'2f06feccca731d6cd388612cd568185ecc29668f');
assert.equal(git('rev-parse','meri-rc1-20261012^{}'),'2f06feccca731d6cd388612cd568185ecc29668f');
assert.equal(git('rev-parse','task/meri-capability-successor-20261012'),base);
assert.equal(git('rev-parse','origin/main'),'8b123bea4c90794dc2d766814b6ddbdbfe0928bc');
const inventory=parse('docs/coordination/r2/capabilities.json');
assert.deepEqual(inventory.records.map(row=>({id:row.fields.ID,disposition:row.acceptedScope.disposition,boundary:row.acceptedScope.boundary})),
 catalog.originals.map(({id,disposition,boundary})=>({id,disposition,boundary})));
const planSha256=createHash('sha256').update(raw('docs/plans/MERI-DEPLOYMENT.md')).digest('hex');
assert.equal(planSha256,inventory.planSha256);
// Historical PR22 packet members are verified at the immutable accepted base,
// because this successor intentionally updates current catalog-count assertions.
const packet=parse('docs/qualification/candidates/capability-successor-20261012/integration/source-packet-manifest.json');
for(const member of packet.files){
 const bytes=execFileSync('git',['show',`${base}:${member.path}`],{cwd:root});
 assert.equal(bytes.length,member.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),member.sha256);
}
console.log(JSON.stringify({status:'PASS_SOURCE_PRESERVATION_ONLY',base,sourceHead:git('rev-parse','HEAD'),
 ledger:{originals:139,selected:96,deferred:43,mappedUnavailable:20,unmappedSelected:76,typedUnavailableOperations:21,
 partialBindingsWithinUnmapped:['query_action_items']},originalDescriptorsSha256:canonicalSha256(original.operations),
 planSha256,workbookSha256:inventory.workbookSha256,retainedBasePacketMembers:packet.files.length,
 sourceEnabled:false,runtime:'UNRUN_SEPARATE_OWNER',gate:'G1_OPEN_G2_G7_UNENTERED'},null,2));
