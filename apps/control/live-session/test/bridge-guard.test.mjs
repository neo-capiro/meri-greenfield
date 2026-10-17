import test from 'node:test';import assert from 'node:assert/strict';
import {BRIDGE_ACTIVATION,BRIDGE_REQUIREMENTS,bridgeActivationOpen,cdpMethodDecision,validateCdpAllowlist,bridgeNavigationDecision,ALWAYS_DENIED_CDP_METHODS} from '../bridge-guard.mjs';
import {validateBrowserPolicy} from '../../../worker/conversation/browser/policy.mjs';
const code=c=>e=>e.code===c;
const policy=validateBrowserPolicy({enabled:true,tools:['browser_navigate','browser_snapshot'],allowedOrigins:['https://records.example'],timeouts:{actionMs:5000,navigationMs:30000},downloads:{enabled:false,formats:[],maxBytes:1,maxFiles:1}});

test('bridge activation is held and names every open owner decision',()=>{
 assert.equal(BRIDGE_ACTIVATION.state,'held');assert.equal(bridgeActivationOpen(),false);
 for(const tag of ['Q-B3','Q-B9','Q-B2','Q-X2'])assert.ok(BRIDGE_REQUIREMENTS.some(r=>r.includes(tag)),tag);
 assert.equal(bridgeActivationOpen({state:'open',evidence:'e/b.json',requirements:BRIDGE_REQUIREMENTS}),true,'only a reviewed record with evidence opens it');
});

test('cookie, storage, context, download, interception and browser methods are always denied, even if allowlisted',()=>{
 for(const m of [...ALWAYS_DENIED_CDP_METHODS,'Fetch.enable','Fetch.continueRequest','Browser.close','Browser.setDownloadBehavior','ServiceWorker.enable'])
  assert.deepEqual(cdpMethodDecision(m,{allowlist:[m]}),{allowed:false,code:'BRIDGE_CDP_DENIED'},m);
 assert.throws(()=>validateCdpAllowlist(['Page.navigate','Network.getAllCookies']),e=>e.code==='BRIDGE_CDP_ALLOWLIST_DENIED_METHOD'&&e.method==='Network.getAllCookies');
 assert.throws(()=>validateCdpAllowlist(['Storage.getUsageAndQuota']),code('BRIDGE_CDP_ALLOWLIST_DENIED_METHOD'),'the whole Storage domain is out');
 assert.equal(cdpMethodDecision('Browser.getVersion',{allowlist:validateCdpAllowlist(['Browser.getVersion'])}).allowed,true);
});

test('without a qualified allowlist every other method refuses; with one, only listed methods pass',()=>{
 for(const m of ['Page.navigate','Runtime.evaluate','Input.dispatchKeyEvent','Accessibility.getFullAXTree'])assert.deepEqual(cdpMethodDecision(m),{allowed:false,code:'BRIDGE_CDP_UNQUALIFIED'});
 const allowlist=validateCdpAllowlist(['Accessibility.getFullAXTree','Page.captureScreenshot']);
 assert.equal(cdpMethodDecision('Accessibility.getFullAXTree',{allowlist}).allowed,true);
 assert.equal(cdpMethodDecision('Runtime.evaluate',{allowlist}).code,'BRIDGE_CDP_NOT_ALLOWED');
 assert.equal(cdpMethodDecision('page.navigate').code,'BRIDGE_CDP_MALFORMED');
 assert.throws(()=>validateCdpAllowlist([]),code('BRIDGE_CDP_ALLOWLIST_INVALID'));
});

test('navigation: private networks always refused (Q-B8); approved list enforced; "access all" refuses until Q-B3 is decided',()=>{
 assert.deepEqual(bridgeNavigationDecision({url:'https://records.example/a',accessMode:'approved-list',policy}),{allowed:true,origin:'https://records.example'});
 assert.equal(bridgeNavigationDecision({url:'https://other.example/',accessMode:'approved-list',policy}).code,'BROWSER_ORIGIN_NOT_ALLOWED');
 for(const url of ['http://10.1.2.3/','http://intranet/','https://host.internal/','http://169.254.169.254/latest'])
  for(const accessMode of ['approved-list','access-all'])assert.equal(bridgeNavigationDecision({url,accessMode,policy}).code,'BRIDGE_PRIVATE_NETWORK_REFUSED',`${url} ${accessMode}`);
 assert.equal(bridgeNavigationDecision({url:'https://other.example/',accessMode:'access-all',policy}).code,'BRIDGE_ACCESS_ALL_UNDECIDED');
 assert.equal(bridgeNavigationDecision({url:'file:///etc/passwd',accessMode:'approved-list',policy}).code,'BROWSER_URL_SCHEME');
 assert.throws(()=>bridgeNavigationDecision({url:'https://records.example/',accessMode:'everything',policy}),code('BRIDGE_CONFIGURATION'));
});
