import test from 'node:test';import assert from 'node:assert/strict';
import {validateSiteWorkflowManifest,siteWorkflowEnablement,siteWorkflowPolicy,siteSessionExpired,APPROVED_SITE_WORKFLOWS,SITE_WORKFLOW_ACTIVATION,SITE_WORKFLOW_REQUIREMENTS,SITE_SESSION_MAX_IDLE_MS,SITE_WORKFLOW_MANIFEST_SCHEMA} from '../manifest.mjs';
import {validateBrowserPolicy} from '../../policy.mjs';
/** Synthetic sites only (.example). No real site is named: Q-A1 is awaiting Neo. */
const MAX=['https://records.example','https://idp.example','https://notices.example'];
const code=(c,field)=>e=>e.code===c&&(field===undefined||e.field===field);
const manifest=(over={})=>({schema:SITE_WORKFLOW_MANIFEST_SCHEMA,siteId:'synthetic-records',workflowId:'download-filings',version:1,taskSummary:'Synthetic: sign in and download the filings list',
 origins:['https://records.example'],idpOrigins:['https://idp.example'],signInUrl:'https://records.example/login',signedInProbe:{kind:'selector',value:'#account-menu'},
 sensitiveSelectors:['#security-answer'],tools:['browser_navigate','browser_snapshot','browser_click','browser_type'],approvalRequired:['browser_click','browser_type'],
 downloads:{formats:['pdf','xlsx'],maxBytes:1048576,maxFiles:3},sessionTtlMs:SITE_SESSION_MAX_IDLE_MS,logoutUrl:'https://records.example/logout',tosReviewRef:null,qualificationEvidenceRef:null,...over});
const v=(m,max=MAX)=>validateSiteWorkflowManifest(m,{platformMaximumOrigins:max});

test('a credential-free manifest inside the platform maximum validates and is frozen',()=>{
 const m=v(manifest());
 assert.equal(m.siteId,'synthetic-records');assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.origins)&&Object.isFrozen(m.downloads));
 assert.deepEqual(v(m),m,'idempotent');
});

test('no credential custody: any credential, cookie, token or stored-session field is refused at any depth',()=>{
 for(const bad of [{password:'x'},{credentials:{}},{storageState:{}},{sessionCookie:'x'},{apiKey:'x'},{signedInProbe:{kind:'selector',value:'#a',token:'x'}},{downloads:{formats:['pdf'],maxBytes:1,maxFiles:1,cookieJar:[]}},{userName:'a'},{totpSeed:'x'},{vaultRef:'v'}])
  assert.throws(()=>v(manifest(bad)),code('SITE_WORKFLOW_CREDENTIAL_REFUSED'));
 assert.throws(()=>v(manifest({signInUrl:'https://user:pw@records.example/login'})),code('SITE_WORKFLOW_MANIFEST','signInUrl'),'credentials in URLs are refused by the platform limits');
});

test('a manifest never widens the platform maximum; IdP origins must be approved too; URLs stay inside the manifest origins',()=>{
 assert.throws(()=>v(manifest(),['https://records.example']),code('SITE_WORKFLOW_OUTSIDE_PLATFORM_MAXIMUM','idpOrigins'));
 assert.throws(()=>v(manifest({origins:['https://other.example']})),code('SITE_WORKFLOW_OUTSIDE_PLATFORM_MAXIMUM','origins'));
 assert.throws(()=>v(manifest({origins:['http://10.0.0.5']}),[...MAX,'http://10.0.0.5']),code('SITE_WORKFLOW_MANIFEST','origins'));
 assert.throws(()=>v(manifest({signInUrl:'https://notices.example/login'})),code('SITE_WORKFLOW_MANIFEST','signInUrl'));
 assert.throws(()=>v(manifest({logoutUrl:'https://notices.example/out'})),code('SITE_WORKFLOW_MANIFEST','logoutUrl'));
 assert.throws(()=>v(manifest({signedInProbe:{kind:'url',value:'https://idp.example/me'}})),code('SITE_WORKFLOW_MANIFEST','signedInProbe'),'the probe checks the site itself');
 assert.throws(()=>v(manifest({origins:[]})),code('SITE_WORKFLOW_MANIFEST','origins'));
});

test('Q-A5: every interaction tool is approval-required; Q-A8: the TTL is at most 8 hours of inactivity',()=>{
 assert.throws(()=>v(manifest({approvalRequired:['browser_click']})),code('SITE_WORKFLOW_PREAPPROVAL_REFUSED'));
 assert.throws(()=>v(manifest({approvalRequired:['browser_click','browser_type','browser_hover']})),code('SITE_WORKFLOW_MANIFEST','approvalRequired'));
 assert.throws(()=>v(manifest({tools:['browser_evaluate']})),code('SITE_WORKFLOW_MANIFEST','tools'));
 assert.throws(()=>v(manifest({sessionTtlMs:SITE_SESSION_MAX_IDLE_MS+1})),code('SITE_WORKFLOW_MANIFEST','sessionTtlMs'));
 assert.equal(v(manifest({sessionTtlMs:3600000})).sessionTtlMs,3600000,'a manifest may shorten it');
 let t=0;const now=()=>t;
 assert.equal(siteSessionExpired({lastActivityMs:0,ttlMs:SITE_SESSION_MAX_IDLE_MS,now}),false);
 t=SITE_SESSION_MAX_IDLE_MS;assert.equal(siteSessionExpired({lastActivityMs:0,ttlMs:SITE_SESSION_MAX_IDLE_MS,now}),true);
 assert.throws(()=>siteSessionExpired({lastActivityMs:0,ttlMs:SITE_SESSION_MAX_IDLE_MS+1,now}),code('SITE_WORKFLOW_CONFIGURATION'));
});

test('enablement fails closed in the shipped state and lists every unmet condition',()=>{
 assert.equal(APPROVED_SITE_WORKFLOWS.length,0,'Q-A1: no site is approved until Neo names them');
 assert.equal(SITE_WORKFLOW_ACTIVATION.state,'held');
 const m=v(manifest());
 assert.deepEqual(siteWorkflowEnablement(m).reasons,['SITE_WORKFLOWS_HELD','SITE_WORKFLOW_TAKEOVER_UNAVAILABLE','SITE_WORKFLOW_NOT_APPROVED','SITE_WORKFLOW_TERMS_REVIEW_MISSING','SITE_WORKFLOW_UNQUALIFIED']);
 const open={state:'open',evidence:'evidence/sites.json',requirements:SITE_WORKFLOW_REQUIREMENTS};
 const ready=v(manifest({tosReviewRef:'legal/synthetic-records-terms',qualificationEvidenceRef:'qualification/synthetic-records-1'}));
 const r=siteWorkflowEnablement(ready,{registry:[{siteId:'synthetic-records',workflowId:'download-filings',version:1}],activation:open,takeoverOpen:true});
 assert.deepEqual([r.enabled,r.reasons.length],[true,0],'only every condition together enables (synthetic inputs, not shipped state)');
 assert.equal(siteWorkflowEnablement(ready,{registry:[{siteId:'synthetic-records',workflowId:'download-filings',version:2}],activation:open,takeoverOpen:true}).enabled,false,'a different approved version does not count');
});

test('the run policy is narrowed to the manifest and never widened; a narrowed-away sign-in origin refuses',()=>{
 const effective=validateBrowserPolicy({enabled:true,tools:['browser_navigate','browser_snapshot','browser_click'],allowedOrigins:['https://notices.example','https://records.example','https://idp.example'],timeouts:{actionMs:5000,navigationMs:30000},downloads:{enabled:true,formats:['pdf','docx'],maxBytes:4096,maxFiles:5}});
 const p=siteWorkflowPolicy(effective,v(manifest()));
 assert.deepEqual(p.allowedOrigins,['https://records.example','https://idp.example']);
 assert.deepEqual(p.tools,['browser_navigate','browser_snapshot','browser_click'],'browser_type stays off: the tenant never enabled it');
 assert.deepEqual([p.downloads.formats,p.downloads.maxBytes,p.downloads.maxFiles],[['pdf'],4096,3]);
 assert.throws(()=>siteWorkflowPolicy({...effective,allowedOrigins:['https://notices.example']},v(manifest())),code('SITE_WORKFLOW_ORIGIN_NARROWED'));
 assert.throws(()=>siteWorkflowPolicy({enabled:false},v(manifest())),code('SITE_WORKFLOW_BROWSER_DISABLED'));
});
