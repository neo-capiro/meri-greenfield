import test from 'node:test';import assert from 'node:assert/strict';
import {validateBrowserPolicy,checkBrowserUrl,browserStatus,DEFAULT_BROWSER_POLICY,BROWSER_TOOLS} from '../policy.mjs';
import {classifyWebUrl,isPublicHost} from '../public-web.mjs';
import {resolveBrowserPolicy,assertTenantBrowserSettings,assertPlatformBrowserLimits} from '../resolution.mjs';
import {enabledPolicy,APPROVED} from './fixtures.mjs';
const code=c=>e=>e.code===c;
test('the capability is on by default and destinations are denied by default: an empty allowlist opens nothing external',()=>{
 for(const p of [validateBrowserPolicy(),validateBrowserPolicy({enabled:true}),validateBrowserPolicy(DEFAULT_BROWSER_POLICY)]){
  assert.equal(p.enabled,true);assert.deepEqual(p.allowedOrigins,[]);assert.deepEqual(p.tools,BROWSER_TOOLS);
  assert.deepEqual(browserStatus(p),{capability:'enabled',destinations:'none',allowedOriginCount:0,notice:'BROWSER_NO_ALLOWED_DESTINATIONS'});
  for(const url of ['https://records.example/a','http://example.com:8080/x','https://8.8.8.8/'])assert.equal(checkBrowserUrl(p,url).code,'BROWSER_NO_ALLOWED_DESTINATIONS',url);
  assert.equal(checkBrowserUrl(p,'about:blank',{allowBlank:true}).ok,true);}
 assert.deepEqual(validateBrowserPolicy(validateBrowserPolicy()),validateBrowserPolicy(),'idempotent');
 assert.deepEqual(browserStatus(validateBrowserPolicy({enabled:false})),{capability:'disabled',destinations:'none',allowedOriginCount:0});
});
test('every platform-blocked class is refused by the URL classifier regardless of policy',()=>{
 const cases={BROWSER_URL_NOT_PUBLIC:['http://127.0.0.1/','http://127.1/','http://2130706433/','http://0x7f.0.0.1/','http://0.0.0.0/','http://10.0.0.8/','http://172.16.5.4/','http://192.168.1.1/','http://100.64.0.1/','http://169.254.169.254/latest/meta-data/','http://169.254.170.2/v2/credentials','http://198.18.0.1/','http://224.0.0.251/','http://239.255.255.250/','http://255.255.255.255/','http://240.0.0.1/','http://192.0.2.1/',
   'http://[::1]/','http://[::]/','http://[::ffff:127.0.0.1]/','http://[::ffff:a9fe:a9fe]/','http://[fd00:ec2::254]/','http://[fc00::1]/','http://[fe80::1]/','http://[ff02::1]/','http://[64:ff9b::a9fe:a9fe]/','http://[2001:db8::1]/','http://[2002:7f00:1::]/','http://[2001::1]/',
   'http://localhost/','http://LOCALHOST:3000/','http://localhost./','http://api.localhost/','http://metadata.google.internal/','http://printer.local/','http://intranet/','http://metadata/','http://host.docker.internal/','http://router.lan/','http://x.home.arpa/','http://1.0.0.127.in-addr.arpa/','http://abc.onion/','http://site.test/'],
  BROWSER_URL_SCHEME:['file:///etc/passwd','data:text/html,<p>x</p>','javascript:alert(1)','chrome://settings','chrome-extension://abc/x','about:config','about:srcdoc','view-source:https://sam.gov/','ftp://sam.gov/','ws://sam.gov/','blob:https://sam.gov/uuid','filesystem:https://sam.gov/x'],
  BROWSER_URL_CREDENTIALS:['https://user:secret@sam.gov/','https://user@sam.gov/','http://:pw@example.com/'],
  BROWSER_URL_MALFORMED:['','not a url','http://',42,undefined]};
 for(const [expected,urls] of Object.entries(cases))for(const url of urls){
  assert.equal(classifyWebUrl(url,{allowBlank:true}).code,expected,String(url));assert.equal(checkBrowserUrl(validateBrowserPolicy(),url,{allowBlank:true}).ok,false,String(url));}
 assert.deepEqual(classifyWebUrl('about:blank',{allowBlank:true}),{ok:true,blank:true});assert.equal(classifyWebUrl('about:blank').code,'BROWSER_URL_SCHEME');
 for(const host of ['sam.gov','www.congress.gov','xn--bcher-kva.example','8.8.8.8','[2606:4700:4700::1111]'])assert.equal(isPublicHost(host),true,host);
});
test('only allowlisted origins open, after the platform limits; a trailing-dot host cannot bypass the list',()=>{
 const p=validateBrowserPolicy(enabledPolicy());
 assert.deepEqual(browserStatus(p),{capability:'enabled',destinations:'allowlisted',allowedOriginCount:2});
 assert.equal(checkBrowserUrl(p,'https://records.example/opp').ok,true);assert.equal(checkBrowserUrl(p,'https://records.example./opp').origin,'https://records.example');
 for(const url of ['https://archive.example/','http://records.example/','https://records.example:8443/','https://sub.records.example/'])assert.equal(checkBrowserUrl(p,url).code,'BROWSER_ORIGIN_NOT_ALLOWED',url);
 assert.equal(checkBrowserUrl(p,'http://127.0.0.1/').code,'BROWSER_URL_NOT_PUBLIC');assert.equal(checkBrowserUrl(p,'https://u:p@records.example/').code,'BROWSER_URL_CREDENTIALS');
});
test('policy validation refuses unknown keys, unbounded tools, malformed origins and limits, and reports platform-limit origins distinctly',()=>{
 const bad=[{enabled:'yes'},{...enabledPolicy(),extra:1},{...enabledPolicy(),installation:{}},{...enabledPolicy(),sourceScopes:[]},{...enabledPolicy(),tools:['browser_evaluate']},{...enabledPolicy(),tools:['browser_run_code_unsafe']},{...enabledPolicy(),tools:['browser_file_upload']},{...enabledPolicy(),tools:[]},
  {...enabledPolicy(),allowedOrigins:['https://records.example/path']},{...enabledPolicy(),allowedOrigins:['*']},{...enabledPolicy(),allowedOrigins:null},{...enabledPolicy(),allowedOrigins:['https://records.example:443']},{...enabledPolicy(),allowedOrigins:['https://Records.example']},{...enabledPolicy(),allowedOrigins:['https://records.example','https://records.example']},{...enabledPolicy(),blockedOrigins:[]},
  {...enabledPolicy(),timeouts:{actionMs:0,navigationMs:30000}},{...enabledPolicy(),downloads:{enabled:true,formats:['exe'],maxBytes:1024,maxFiles:1}},{...enabledPolicy(),downloads:{enabled:true,formats:['pdf'],maxBytes:10**9,maxFiles:1}},{...enabledPolicy(),downloads:{enabled:true,formats:[],maxBytes:1,maxFiles:1}}];
 for(const policy of bad)assert.throws(()=>validateBrowserPolicy(policy),code('BROWSER_POLICY'),JSON.stringify(policy).slice(0,120));
 for(const o of ['http://127.0.0.1','http://localhost','http://169.254.169.254','http://[::1]','http://10.1.2.3','http://[fd00::1]','http://metadata.google.internal','file:///etc','https://user:pw@records.example'])assert.throws(()=>validateBrowserPolicy(enabledPolicy({allowedOrigins:[o]})),code('BROWSER_PLATFORM_LIMIT'),o);
 assert.equal(validateBrowserPolicy(enabledPolicy({allowedOrigins:['http://records.example']})).allowedOrigins[0],'http://records.example','plain http public origins are web origins');
 assert.deepEqual(validateBrowserPolicy(enabledPolicy({allowedOrigins:[]})).allowedOrigins,[],'an empty allowlist is valid and keeps the capability on');
});
const role=(over={})=>({...DEFAULT_BROWSER_POLICY,allowedOrigins:APPROVED,...over});
const platform=(over={})=>({maximum:role(),defaults:role({allowedOrigins:APPROVED.slice(0,2)}),roleCeilings:{member:role(),viewer:role({tools:['browser_navigate','browser_snapshot','browser_take_screenshot'],downloads:{enabled:false,formats:['pdf'],maxBytes:1024,maxFiles:1}})},...over});
const same=p=>({maximum:p,defaults:p,roleCeilings:{member:p}});
test('resolution: platform-approved origins from trusted config, defaults on, role ceilings narrow, tenant admins narrow or enable approved origins',()=>{
 const member=resolveBrowserPolicy({platform:platform(),role:'member'});assert.equal(member.enabled,true);assert.deepEqual(member.allowedOrigins,APPROVED.slice(0,2));
 const viewer=resolveBrowserPolicy({platform:platform(),role:'viewer'});assert.deepEqual(viewer.tools,['browser_navigate','browser_snapshot','browser_take_screenshot']);assert.equal(viewer.downloads.enabled,false);
 assert.deepEqual(resolveBrowserPolicy({platform:same(DEFAULT_BROWSER_POLICY),role:'member'}),validateBrowserPolicy(),'source defaults alone: capability on, no destinations');
 const enabledApproved=resolveBrowserPolicy({platform:platform(),tenant:{browser:{allowedOrigins:[APPROVED[2],APPROVED[0]]}},role:'member'});
 assert.deepEqual(enabledApproved.allowedOrigins,[APPROVED[0],APPROVED[2]],'a tenant may enable an approved origin the default left out (order follows the platform list)');
 const narrowed=resolveBrowserPolicy({platform:platform(),tenant:{browser:{allowedOrigins:[APPROVED[0]],downloads:{maxFiles:3}}},role:'member'});
 assert.deepEqual(narrowed.allowedOrigins,[APPROVED[0]]);assert.equal(narrowed.downloads.maxFiles,3);assert.equal(narrowed.downloads.maxBytes,DEFAULT_BROWSER_POLICY.downloads.maxBytes);
 const roleNarrow=resolveBrowserPolicy({platform:platform(),tenant:{roles:{member:{allowedOrigins:[APPROVED[1]],tools:['browser_navigate','browser_snapshot']}}},role:'member'});
 assert.deepEqual(roleNarrow.allowedOrigins,[APPROVED[1]]);assert.deepEqual(roleNarrow.tools,['browser_navigate','browser_snapshot']);
 assert.deepEqual(resolveBrowserPolicy({platform:platform(),tenant:{browser:{enabled:false}},role:'member'}),{enabled:false});
 const none=resolveBrowserPolicy({platform:platform(),tenant:{browser:{allowedOrigins:[APPROVED[0]]},roles:{member:{allowedOrigins:[APPROVED[1]]}}},role:'member'});
 assert.equal(none.enabled,true);assert.deepEqual(none.allowedOrigins,[]);assert.equal(browserStatus(none).destinations,'none','a disjoint narrowing leaves the capability on with no destination');
});
test('resolution: tenant and role widening attempts refuse with stable codes, platform security limits cannot be removed',()=>{
 const widen=[[platform(),{browser:{allowedOrigins:['https://unapproved.example']}},'allowedOrigins'],[platform(),{browser:{allowedOrigins:[...APPROVED,'https://unapproved.example']}},'allowedOrigins'],
  [same(role({enabled:false})),{browser:{enabled:true}},'enabled'],
  [same(role({tools:['browser_navigate']})),{browser:{tools:['browser_navigate','browser_click']}},'tools'],
  [same(role({downloads:{enabled:true,formats:['pdf'],maxBytes:1024,maxFiles:1}})),{browser:{downloads:{maxBytes:2048}}},'downloads'],
  [same(role({downloads:{enabled:false,formats:['pdf'],maxBytes:1024,maxFiles:1}})),{browser:{downloads:{enabled:true}}},'downloads'],
  [same(role({timeouts:{actionMs:2000,navigationMs:2000}})),{browser:{timeouts:{navigationMs:3000}}},'timeouts']];
 for(const [p,tenant,field] of widen){
  assert.throws(()=>resolveBrowserPolicy({platform:p,tenant,role:'member'}),e=>e.code==='BROWSER_TENANT_WIDENING_REFUSED'&&e.field===field,field);
  assert.throws(()=>assertTenantBrowserSettings(tenant,assertPlatformBrowserLimits(p)),e=>e.code==='BROWSER_TENANT_WIDENING_REFUSED',`write-time ${field}`);}
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{roles:{viewer:{tools:['browser_navigate','browser_click']}}},role:'viewer'}),e=>e.code==='BROWSER_ROLE_WIDENING_REFUSED'&&e.field==='tools');
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{roles:{viewer:{downloads:{enabled:true}}}},role:'viewer'}),e=>e.code==='BROWSER_ROLE_WIDENING_REFUSED'&&e.field==='downloads');
 assert.throws(()=>resolveBrowserPolicy({platform:platform({roleCeilings:{member:role({allowedOrigins:[APPROVED[0]]})}}),tenant:{roles:{member:{allowedOrigins:[APPROVED[1]]}}},role:'member'}),e=>e.code==='BROWSER_ROLE_WIDENING_REFUSED'&&e.field==='allowedOrigins');
 for(const o of ['http://169.254.169.254','http://localhost','http://10.0.0.1','http://[::1]'])assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{browser:{allowedOrigins:[o]}},role:'member'}),code('BROWSER_PLATFORM_LIMIT'),o);
 assert.throws(()=>resolveBrowserPolicy({platform:platform({maximum:role({allowedOrigins:['http://127.0.0.1']})}),role:'member'}),code('BROWSER_PLATFORM_LIMIT'),'not even the platform record can approve a private origin');
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{browser:{installation:{}}},role:'member'}),code('BROWSER_TENANT_SETTINGS_REFUSED'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{browser:{blockedOrigins:[]}},role:'member'}),code('BROWSER_TENANT_SETTINGS_REFUSED'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{browser:{tools:null}},role:'member'}),code('BROWSER_TENANT_SETTINGS_REFUSED'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),role:'admin'}),code('BROWSER_ROLE_UNKNOWN'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),tenant:{roles:{admin:{}}},role:'member'}),code('BROWSER_ROLE_UNKNOWN'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform({defaults:role({allowedOrigins:['https://unapproved.example']})}),role:'member'}),e=>e.code==='BROWSER_PLATFORM_LIMITS_REFUSED'&&e.field==='defaults.allowedOrigins');
 assert.throws(()=>resolveBrowserPolicy({platform:platform({roleCeilings:{}}),role:'member'}),code('BROWSER_PLATFORM_LIMITS_REFUSED'));
 assert.throws(()=>resolveBrowserPolicy({platform:platform(),role:'member',extra:1}),code('BROWSER_POLICY_INPUT_REFUSED'));
});
test('H4: mistyped tenant and role settings refuse at write time and at run time instead of being coerced',()=>{
 const p=platform(),limits=assertPlatformBrowserLimits(p);
 const cases=[[{browser:{enabled:'yes'}},'enabled'],[{browser:{downloads:{enabled:'yes'}}},'downloads.enabled'],[{browser:{enabled:1}},'enabled'],[{browser:{enabled:null}},'enabled'],
  [{browser:{tools:'browser_navigate'}},'tools'],[{browser:{allowedOrigins:APPROVED[0]}},'allowedOrigins'],[{browser:{timeouts:{actionMs:'5000'}}},'timeouts.actionMs'],
  [{browser:{downloads:{maxFiles:'3'}}},'downloads.maxFiles'],[{browser:{downloads:{formats:'pdf'}}},'downloads.formats'],[{browser:{downloads:{enabled:0}}},'downloads.enabled'],
  [{roles:{member:{enabled:'yes'}}},'enabled'],[{roles:{member:{downloads:{enabled:'yes'}}}},'downloads.enabled'],[{roles:{viewer:{enabled:'false'}}},'enabled']];
 for(const [tenant,field] of cases){
  const label=JSON.stringify(tenant),refused=e=>e.code==='BROWSER_TENANT_SETTINGS_REFUSED'&&e.field===field;
  assert.throws(()=>assertTenantBrowserSettings(tenant,limits),refused,`write time ${label}`);
  for(const role of ['member','viewer'])assert.throws(()=>resolveBrowserPolicy({platform:p,tenant,role}),refused,`run time ${role} ${label}`);
 }
 assert.equal(resolveBrowserPolicy({platform:p,tenant:{browser:{downloads:{enabled:false}}},role:'member'}).downloads.enabled,false,'a real boolean false still narrows');
 assert.deepEqual(resolveBrowserPolicy({platform:p,tenant:{browser:{enabled:false}},role:'member'}),{enabled:false});
 assert.equal(resolveBrowserPolicy({platform:p,tenant:{browser:{enabled:true,tools:[]}},role:'member'}).enabled,false,'normalization still turns off a valid flag whose scope is empty');
});
