import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeMailSenderResolver,MAIL_SENDER_REFUSALS} from '../mail-sender.mjs';
import {binding as seed,id} from '../../../control/conversations/test/store-fixture.mjs';
const binding={...seed,tenantId:id(80),actorId:id(81)};
const at=1800000000000,clientId=id(5),principal={tenantId:binding.tenantId,actorId:binding.actorId};
// Core's sending projection (`GET /api/engagement/mail/mailboxes`): only connected, owned, token-holding mailboxes with an address.
const mailbox=(n,accountEmail,provider='microsoft_365')=>({id:id(n),provider,accountEmail,displayName:null});
function fixture({general=true,rows=[mailbox(700,'Owner@Example.test')]}={}){
 const state={now:at,credential:'synthetic-native',rows,requests:[],principal,onInventory:null};
 const selectedClientId=general?null:clientId,now=()=>state.now;
 const nativeCredentials={nativeCredentialFor(){if(!state.credential)throw Error('no session');return {credential:state.credential,expiresAtMs:at+30000};}};
 const resolve=createNativeMailSenderResolver({origin:'https://core.invalid',nativeCredentials,now,maxRequestMs:3000,async fetchImpl(url,init){
  const path=new URL(url).pathname;state.requests.push({path,authorization:init.headers.authorization});
  const identity={principal:state.principal,identityRevision:'a'.repeat(64),checkedAtMs:now(),expiresAtMs:at+30000};
  if(path==='/api/engagement/mail/mailboxes'){assert.equal(init.method,'GET');state.onInventory?.();return Response.json(state.rows);}
  assert.notEqual(path,'/api/engagement/integrations','the settings inventory is not the sending predicate');
  if(path.endsWith('/identity'))return Response.json(identity);
  assert(path.endsWith('/current'));
  return Response.json({...identity,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId});
 }});
 return {state,resolve,call:{binding,selectedClientId,deadlineMs:at+10000}};
}
const refusal=(reason,list=[])=>e=>e.code==='INVALID_ARGUMENTS'&&e.effect==='none'&&e.detail===MAIL_SENDER_REFUSALS[reason](list);
for(const general of [true,false])test(`${general?'General':'client'} mail uses the one sending mailbox Core reports for the actor`,async()=>{
 const f=fixture({general});
 assert.deepEqual(await f.resolve(f.call),{senderConnectionId:id(700),senderEmail:'owner@example.test'});
 assert(f.state.requests.every(r=>r.authorization==='Bearer synthetic-native'));
 assert.equal(f.state.requests.filter(r=>r.path==='/api/engagement/mail/mailboxes').length,1);
});
test('a named address selects among several sending mailboxes; otherwise the refusal lists the addresses to choose from',async()=>{
 const f=fixture({rows:[mailbox(700,'owner@example.test'),mailbox(701,'second@example.test','google_workspace')]});
 assert.deepEqual(await f.resolve({...f.call,senderEmail:'Second@Example.test'}),{senderConnectionId:id(701),senderEmail:'second@example.test'});
 const list=['owner@example.test','second@example.test'];
 await assert.rejects(f.resolve(f.call),refusal('several',list));
 await assert.rejects(f.resolve({...f.call,senderEmail:'other@example.test'}),refusal('unknown',list));
 assert.match(MAIL_SENDER_REFUSALS.several(list),/\(owner@example\.test, second@example\.test\)/u);
 assert.doesNotMatch(MAIL_SENDER_REFUSALS.unknown(list),/omit it/u);
 assert.doesNotMatch(MAIL_SENDER_REFUSALS.several(list),/[0-9a-f]{8}-[0-9a-f]{4}/u,'identifiers never reach the model');
});
test('mail refuses in plain words when Core reports no sending mailbox',async()=>{const f=fixture({rows:[]});await assert.rejects(f.resolve(f.call),refusal('none'));});
for(const [name,rows] of Object.entries({'no address':[mailbox(700,'  ')],'duplicate':[mailbox(700,'a@example.test'),mailbox(700,'b@example.test')],'not an id':[{id:'x',accountEmail:'a@example.test'}]}))
 test(`a malformed sending projection (${name}) is refused, never guessed`,async()=>{const f=fixture({rows});await assert.rejects(f.resolve(f.call),e=>e.effect==='none'&&e.code!=='INVALID_ARGUMENTS');});
for(const failure of ['session revoked','session replaced','foreign principal','deadline'])test(`mail sender resolution refuses ${failure}`,async()=>{
 const f=fixture();
 if(failure==='session revoked')f.state.credential=null;
 if(failure==='foreign principal')f.state.principal={...principal,actorId:id(99)};
 f.state.onInventory=()=>{if(failure==='session replaced')f.state.credential='replacement';if(failure==='deadline')f.state.now=at+3001;};
 await assert.rejects(f.resolve(f.call),e=>e.effect==='none'&&['ACCESS_DENIED','DEADLINE','UNAVAILABLE'].includes(e.code));
});
