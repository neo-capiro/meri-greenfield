/** SCRATCH PROPOSAL ONLY. Executes the actual proposed middleware class with synthetic dependencies.
 * The only instrumentation appends a private-provenance fixture seed export to the scratch copy.
 * It does not run Nest request admission, Clerk, PostgreSQL locks or a deployment. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {isAbsolute,resolve,sep} from 'node:path';
import * as vm from 'node:vm';
const require=createRequire(import.meta.url);
const explicitTypeScript=process.env.CORE_PROPOSAL_TYPESCRIPT_MODULE;
if(explicitTypeScript!==undefined&&!isAbsolute(explicitTypeScript))throw Error('CORE_PROPOSAL_TYPESCRIPT_MODULE must be an absolute module path');
const ts=require(explicitTypeScript??'typescript');
assert.equal(ts.version,'5.9.3','Proposal requires exactly TypeScript 5.9.3');
const runRoot=process.env.CORE_PROPOSAL_RUN_ROOT;
if(typeof runRoot!=='string'||!isAbsolute(runRoot))throw Error('Prepare an isolated scratch tree and set absolute CORE_PROPOSAL_RUN_ROOT');
const root=pathToFileURL(resolve(runRoot)+sep);
const kind=process.env.CORE_PROPOSAL_VARIANT??'proposed';
assert.ok(['baseline','proposed'].includes(kind));
const source=await readFile(new URL(`${kind}/apps/api/src/tenant/tenant-context.middleware.ts`,root),'utf8');
const authority=await readFile(new URL('baseline/apps/api/src/auth/application-authority.ts',root),'utf8');
const clock={value:null};
class ClockDate extends Date {constructor(...args){super(...(args.length?args:[clock.value??Date.now()]));}static now(){return clock.value??Date.now();}}
const context=vm.createContext({Date:ClockDate,Buffer,console,setTimeout,clearTimeout,process:{env:{}}});
const cache=new Map();
class Refusal extends Error {}
const exportsByName={
 ForbiddenException:Refusal,UnauthorizedException:Refusal,ServiceUnavailableException:Refusal,BadRequestException:Refusal,
 Injectable:()=>()=>{},Logger:class {warn(){} error(){} log(){}},
 isMeriExecutionCapabilityPost:()=>false,isMeriRoutineUnattendedGrantPost:()=>false,isMeriReadTokenRequest:()=>false,isMeriReadDelegationServicePost:()=>false,isPreviewNativeReadRoute:()=>false,
 ROLE_RANK:{standard_user:1,user_admin:2,capiro_admin:3},TENANT_HEADER:'x-tenant',authDeniedEvent:x=>x,
};
function compile(s){const r=ts.transpileModule(s,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,experimentalDecorators:true}});assert.equal((r.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);return r.outputText;}
function imports(s){const ast=ts.createSourceFile('module.mjs',s,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);const result=new Map();for(const statement of ast.statements){if(!ts.isImportDeclaration(statement))continue;const names=statement.importClause?.namedBindings;result.set(statement.moduleSpecifier.text,names&&ts.isNamedImports(names)?names.elements.map(x=>(x.propertyName??x.name).text):[]);}return result;}
async function load(id,s){const code=compile(s),required=imports(code),m=new vm.SourceTextModule(code,{context,identifier:id});cache.set(id,m);await m.link(async spec=>{
 if(spec==='../auth/application-authority.js')return cache.get('authority')??load('authority',authority);
 const key='stub:'+spec+':'+required.get(spec)?.join(',');if(cache.has(key))return cache.get(key);
 const names=required.get(spec)??[];const actual=spec.startsWith('node:')?await import(spec):null;
 const stub=new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,actual?.[name]??exportsByName[name]??class {});},{context,identifier:key});cache.set(key,stub);return stub;
 });return m;}
const module=await load('middleware',source+'\nexport function seedProvenance(req, value) { applicationAuthorityRequests.set(req,value); }\n');await module.evaluate();
const {TenantContextMiddleware,seedProvenance}=module.namespace;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const plain=v=>JSON.parse(JSON.stringify(v));
function harness({record=true,changes={},fresh=()=>{},missing=null,withSystemAllowed=false}={}){
 const at=Date.now(),events=[],ctx={tenantId:id(1),userId:id(2),clerkUserId:'user_1',tenantSlug:'tenant',role:'standard_user'},claims={sub:'user_1',sid:'sess_1',exp:Math.floor(at/1000)+120,capiro_tenant_id:id(1),capiro_tenant_slug:'tenant',org_id:'org_1'};
 const req={method:'POST',path:'/api/clio/application-authority/history-release',originalUrl:'/api/clio/application-authority/history-release',headers:{authorization:'Bearer native_fixture'},header(name){return this.headers[name];}};
 const provenance={context:ctx,claims,membershipId:id(3),membershipTenantId:id(1),requestedSlug:undefined,impersonationId:null,...changes};
 const row={id:id(3),tenantId:id(1),userId:id(2),status:'active',role:'standard_user',updatedAt:new Date(at-10000),tenant:{id:id(1),status:'active',slug:'tenant',clerkOrgId:'org_1'}};
 const state={row,systemCalls:0,online:0,sessionExpiresAt:at+60000,sessionId:'sess_1'};
 const tx={$queryRaw:async(strings,...args)=>{const sql=strings.join('?');const table=/FROM\s+(\w+)/u.exec(sql)?.[1];events.push('lock:'+table);assert.match(sql,/FOR SHARE/u);if(table==='users'){assert.match(sql,/WHERE\s+id\s*=\s*\?::uuid\s+AND\s+clerk_user_id\s*=\s*\?/u);}if(table==='tenants'){assert.match(sql,/WHERE\s+id\s*=\s*\?::uuid/u);}if(table==='tenant_memberships'){assert.match(sql,/WHERE\s+id\s*=\s*\?::uuid\s+AND\s+tenant_id\s*=\s*\?::uuid\s+AND\s+user_id\s*=\s*\?::uuid/u);}if(table==='users'){assert.deepEqual(args,[ctx.userId,claims.sub]);return missing==='user'?[]:[{id:ctx.userId}];}if(table==='tenants'){assert.deepEqual(args,[ctx.tenantId]);return missing==='tenant'?[]:[{id:ctx.tenantId}];}if(table==='tenant_memberships'){assert.deepEqual(args,[provenance.membershipId,provenance.membershipTenantId,ctx.userId]);return missing==='membership'?[]:[{id:provenance.membershipId}];}throw Error('unexpected SQL');},user:{findFirst:async args=>{events.push('read:user');await state.onRead?.('user');assert.deepEqual(plain(args.where),{id:ctx.userId,clerkUserId:claims.sub});return {id:ctx.userId,clerkUserId:claims.sub};}},tenantMembership:{findFirst:async args=>{events.push('read:membership');await state.onRead?.('membership');assert.deepEqual(plain(args.where),{id:provenance.membershipId,tenantId:provenance.membershipTenantId,userId:ctx.userId,status:'active'});return state.row;}}};
 const clerk={async assertActiveApplicationAuthoritySession(selectedClaims){state.online++;assert.deepEqual(plain(selectedClaims),claims);events.push('Clerk:online');await fresh({state,events,ctx});return {id:state.sessionId,userId:'user_1',status:'active',createdAt:at-20000,expireAt:state.sessionExpiresAt,abandonAt:state.sessionExpiresAt,actor:null,expiresAtMs:state.sessionExpiresAt};},async assertActiveMeriControlCredentialSession(){throw Error('marked owner must not run');}};
 const prisma={async withSystem(run){state.systemCalls++;if(!withSystemAllowed)throw Error('nested system lease prohibited');return run(tx);}};
 const middleware=new TenantContextMiddleware(clerk,prisma,{});if(record)seedProvenance(req,provenance);
 return {middleware,req,ctx,provenance,tx,clerk,prisma,state,events,at,claims};
}
const denied=e=>e?.message==='Application authority unavailable';
test('proposal provides the two exact batch-native interface methods',()=>{assert.equal(typeof TenantContextMiddleware.prototype.lockOriginalApplicationAuthorityInTransaction,'function');assert.equal(typeof TenantContextMiddleware.prototype.readFreshApplicationAuthorityInTransaction,'function');});
test('locks exact original native user, tenant and selected membership before new online observation on caller transaction',async()=>{const h=harness();await h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,h.ctx,h.tx);const receipt=await h.middleware.readFreshApplicationAuthorityInTransaction(h.req,h.ctx,h.tx);assert.deepEqual(plain(receipt.principal),{tenantId:h.ctx.tenantId,actorId:h.ctx.userId});assert.deepEqual(h.events,['lock:users','lock:tenants','lock:tenant_memberships','Clerk:online','read:user','read:membership']);assert.equal(h.state.systemCalls,0);assert.equal(h.state.online,1);});
for(const missing of ['user','tenant','membership'])test(`missing original ${missing} refuses; no online call or alternate membership`,async()=>{const h=harness({missing});await assert.rejects(h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,h.ctx,h.tx),denied);assert.equal(h.state.online,0);assert.equal(h.state.systemCalls,0);});
for(const name of ['unrecorded','different context object','different principal','marked control','impersonation','membership tenant','missing sid','wrong method','trailing slash','rewritten target','query string','delegated scheme'])test(`unqualified ${name} refuses before SQL or online observation`,async()=>{const h=harness({record:name!=='unrecorded'});let ctx=h.ctx;if(name==='different context object')ctx={...ctx};if(name==='different principal')h.ctx.clerkUserId='user_other';if(name==='marked control')h.provenance.claims.meri_control_credential=true;if(name==='impersonation')h.provenance.impersonationId=id(91);if(name==='membership tenant')h.provenance.membershipTenantId=id(92);if(name==='missing sid')delete h.provenance.claims.sid;if(name==='wrong method')h.req.method='GET';if(name==='trailing slash')h.req.path=h.req.originalUrl+=' /'.trim();if(name==='rewritten target')h.req.originalUrl='/api/other';if(name==='query string')h.req.originalUrl+='?a=1';if(name==='delegated scheme')h.req.headers.authorization='CapiroMeriRead fixture';await assert.rejects(h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,ctx,h.tx),denied);await assert.rejects(h.middleware.readFreshApplicationAuthorityInTransaction(h.req,ctx,h.tx),denied);assert.deepEqual(h.events,[]);assert.equal(h.state.systemCalls,0);});
test('a NEW online Clerk denial is not replaced by initial or cached session evidence',async()=>{const h=harness({fresh:()=>{throw Error('fixture revoked');}});await h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,h.ctx,h.tx);await assert.rejects(h.middleware.readFreshApplicationAuthorityInTransaction(h.req,h.ctx,h.tx),/fixture revoked/);assert.equal(h.state.online,1);assert.equal(h.events.includes('read:user'),false);assert.equal(h.state.systemCalls,0);});
for(const name of ['member removed','role changed','tenant inactive','org changed'])test(`current locked ${name} refuses after online observation`,async()=>{const h=harness({fresh:({state})=>{if(name==='member removed')state.row={...state.row,status:'removed'};if(name==='role changed')state.row={...state.row,role:'user_admin'};if(name==='tenant inactive')state.row={...state.row,tenant:{...state.row.tenant,status:'inactive'}};if(name==='org changed')state.row={...state.row,tenant:{...state.row.tenant,clerkOrgId:'org_other'}};}});await h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,h.ctx,h.tx);await assert.rejects(h.middleware.readFreshApplicationAuthorityInTransaction(h.req,h.ctx,h.tx),denied);assert.equal(h.state.systemCalls,0);});
test('ordinary existing authority default retains its separate system owner and current receipt recheck',async()=>{const h=harness({withSystemAllowed:true});h.req.path=h.req.originalUrl='/api/clio/application-authority/identity';const receipt=await h.middleware.readApplicationAuthority(h.req,h.ctx);assert.equal(h.state.systemCalls,1);const current=await receipt.recheckCurrent();assert.deepEqual(plain(current.principal),{tenantId:h.ctx.tenantId,actorId:h.ctx.userId});assert.equal(h.state.systemCalls,2);assert.equal(h.state.online,1);});
test('ordinary existing impersonation remains supported',async()=>{
 const h=harness({withSystemAllowed:true});const now=Date.now();h.ctx.role='capiro_admin';h.ctx.tenantId=id(99);h.ctx.tenantSlug='target';h.state.row.role='capiro_admin';h.provenance.impersonationId=id(88);h.req.path=h.req.originalUrl='/api/clio/application-authority/identity';
 h.tx.impersonationSession={findFirst:async args=>{assert.deepEqual(plain({...args.where,expiresAt:undefined}),{id:id(88),actorUserId:id(2),tenantId:id(99),endedAt:null});return {id:id(88),actorUserId:id(2),tenantId:id(99),startedAt:new Date(now-1000),expiresAt:new Date(now+30000),endedAt:null,tenant:{id:id(99),status:'active',slug:'target',clerkOrgId:'org_target'}};}};
 const receipt=await h.middleware.readApplicationAuthority(h.req,h.ctx);assert.equal(receipt.principal.tenantId,id(99));assert.equal(receipt.principal.actorId,id(2));assert.equal(h.state.systemCalls,1);
});

// Import the unchanged published batch/wire/leaf, not a reimplementation of them.
async function moduleUrl(relative,replacements={}){let s=await readFile(new URL('baseline/'+relative,root),'utf8');for(const[from,to]of Object.entries(replacements))s=s.replaceAll(`from '${from}'`,`from '${to}'`);return 'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64');}
const jcsUrl=await moduleUrl('packages/shared/src/core-retained-jcs.ts');
const wireUrl=await moduleUrl('apps/api/src/auth/history-release-source.ts',{'@capiro/shared/core-retained-jcs':jcsUrl});
const leafUrl=await moduleUrl('apps/api/src/auth/history-release-selected-client-owner.ts');
const batchUrl=await moduleUrl('apps/api/src/auth/history-release-batch-owner.ts',{'./history-release-source.js':wireUrl,'./history-release-selected-client-owner.js':leafUrl});
const {readHistoryReleaseSource,HistoryReleaseSourceError}=await import(wireUrl);
const {createHistoryReleaseBatchPort}=await import(batchUrl);
const batchDenied=e=>e instanceof HistoryReleaseSourceError&&e.code==='UNAVAILABLE';
const selectedSubject={conversationId:id(4),clientId:id(5),scopes:[{tenantId:id(1),kind:'client',resourceId:id(5),policyRevision:'pinned'}]};
function composition({commitError=false,onCommit=()=>{},onStart=()=>{},fresh=()=>{}}={}){
 const h=harness({withSystemAllowed:true,fresh});let inTransaction=false;
 const raw=h.tx.$queryRaw;
 h.tx.$queryRaw=async(strings,...args)=>{const sql=strings.join('?');if(sql.includes('FROM clio_conversations')){h.events.push('lock:conversation');assert.match(sql,/tenant_id\s*=\s*\?::uuid\s+AND\s+user_id\s*=\s*\?::uuid\s+AND\s+id\s*=\s*\?::uuid/u);assert.deepEqual(args,[id(1),id(2),id(4)]);return[{id:id(4),tenantId:id(1),userId:id(2),clientId:id(5),status:'active',archivedAt:null,metadata:{}}];}if(sql.includes('FROM clients')){h.events.push('lock:client');assert.match(sql,/WHERE\s+tenant_id\s*=\s*\?::uuid\s+AND\s+id\s*=\s*\?::uuid/u);assert.deepEqual(args,[id(1),id(5)]);return[{id:id(5),tenantId:id(1),status:'active',memoryWall:false}];}return raw(strings,...args);};
 const system=h.prisma.withSystem;h.prisma.withSystem=async run=>{assert.equal(inTransaction,false,'must not borrow a second lease under the RR locks');return system(run);};
 const transactionOwner={async withTenant(tenant,run,options){assert.equal(tenant,id(1));assert.deepEqual(options,{timeoutMs:4000,isolationLevel:'RepeatableRead'});h.events.push('RR:start');inTransaction=true;await onStart(h);try{const result=await run(h.tx);await onCommit(h);if(commitError)throw Error('fixture commit failed');h.events.push('RR:commit');return result;}finally{inTransaction=false;}}};
 const now=()=>clock.value??Date.now();const port=createHistoryReleaseBatchPort({req:h.req,ctx:h.ctx,native:h.middleware,prisma:transactionOwner,now});
 const read=(subjects=[])=>readHistoryReleaseSource({schemaVersion:1,observationId:id(9),route:'list',responseSha256:'a'.repeat(64),subjects},{tenantId:id(1),actorId:id(2)},port,now);
 return {...h,read};
}
for(const subjects of [[],[selectedSubject]])test(`real proposed middleware composes with published batch for ${subjects.length?'selected subject':'empty list'}`,async()=>{const h=composition();const receipt=await h.read(subjects);assert.equal(receipt.responseSha256,'a'.repeat(64));assert.equal(h.state.online,2);assert.equal(h.state.systemCalls,1);const native=['Clerk:online','read:user','read:membership'];assert.deepEqual(h.events,[...native,'RR:start','lock:users','lock:tenants','lock:tenant_memberships',...(subjects.length?['lock:conversation','lock:client']:[]),...native,'RR:commit']);});
for(const mode of ['commit failure','commit expiry','fresh session expiry','local-read expiry','changed session revision','replacement membership'])test(`real native/batch/wire refuses ${mode}`,async t=>{
 t.after(()=>{clock.value=null;});
 const h=composition({commitError:mode==='commit failure',onCommit:state=>{if(mode==='commit expiry')clock.value=state.state.sessionExpiresAt;},onStart:state=>{if(mode==='replacement membership')state.state.row={...state.state.row,id:id(99)};if(mode==='local-read expiry')state.state.onRead=phase=>{if(phase==='membership')clock.value=state.state.sessionExpiresAt;};},fresh:({state})=>{if(state.online===2){if(mode==='fresh session expiry')state.sessionExpiresAt=Date.now()-1;if(mode==='changed session revision')state.sessionId='sess_other';}}});
 await assert.rejects(h.read([selectedSubject]),batchDenied);assert.equal(h.state.systemCalls,1);assert.equal(h.events.includes('RR:commit'),mode==='commit expiry');
});
test('ordinary native use() records actual private provenance for the new unmounted owner',async()=>{
 const h=harness({record:false,withSystemAllowed:true});h.req.hostname='app.capiro.ai';h.req.baseUrl='';h.clerk.verifySessionToken=async()=>({...h.claims});h.tx.user.findUnique=async()=>({id:id(2),clerkUserId:'user_1'});h.tx.user.update=async()=>({id:id(2)});h.tx.tenantMembership.findMany=async()=>[h.state.row];h.middleware.store.run=(_ctx,run)=>run();const headers={};let next=0;
 await h.middleware.use(h.req,{setHeader:(name,value)=>{headers[name]=value;}},()=>{next++;});assert.equal(next,1);const ctx=h.req.tenantContext;assert.equal(ctx.userId,id(2));await h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req,ctx,h.tx);await h.middleware.readFreshApplicationAuthorityInTransaction(h.req,ctx,h.tx);assert.equal(headers['Cache-Control'],'no-store');assert.equal(h.state.online,1);
});
test('history-release pre-auth denials receive no-store without extending marked credential admission',async()=>{
 const h=harness({record:false,withSystemAllowed:true});h.clerk.verifySessionToken=async()=>({...h.claims,meri_control_credential:true});const headers={};let next=0;await assert.rejects(h.middleware.use(h.req,{setHeader:(k,v)=>{headers[k]=v;}},()=>{next++;}),denied);assert.equal(next,0);assert.equal(h.state.systemCalls,0);assert.equal(h.state.online,0);assert.equal(headers['Cache-Control'],'no-store');
});
