import test from 'node:test';import assert from 'node:assert/strict';
import {parseCodeDiscovery,createCollaboraCodeLaunch,CODE_DISCOVERY_MAX_BYTES} from '../collabora-code.mjs';
import {createWopiAccessTokenCodec} from '../wopi-access-token.mjs';
const editorOrigin='https://office.example.test',wopiOrigin='https://app.example.test',t=1793238000000,now=()=>t;
const action=(format='docx',mode='edit',url='https://office.example.test/browser/fixture/cool.html?')=>`<action ext="${format}" name="${mode}" urlsrc="${url}"/>`;
const discovery=body=>Buffer.from(`<wopi-discovery><net-zone name="external-https"><app name="writer">${body}</app></net-zone></wopi-discovery>`);
const bytes=discovery(['docx','xlsx','pptx'].flatMap(f=>['edit','view'].map(m=>action(f,m))).join(''));
const claims={editSessionId:'00000002-0000-4000-8000-000000000002',fileId:'es-2',versionId:'00000001-0000-4000-8000-000000000001',
 actorId:'actor-fixture',tenantId:'tenant-fixture',userCanWrite:true,expiresAtMs:t+600000,suppressionGeneration:4};
const code=c=>e=>e.code===c;
test('CODE launch uses discovered same-origin action with token and absolute expiry only in POST fields',()=>{
 const codec=createWopiAccessTokenCodec({key:Buffer.alloc(32,9),now});
 const launch=createCollaboraCodeLaunch({editorOrigin,wopiOrigin,discoveryBytes:bytes,codec,now});
 for(const format of ['docx','xlsx','pptx'])for(const userCanWrite of [true,false]){
  const c={...claims,userCanWrite},form=launch.launch(c,{format}),url=new URL(form.actionUrl);
  assert.equal(form.method,'POST');assert.equal(form.edition,'collabora-code');assert.equal(url.origin,editorOrigin);
  assert.deepEqual([...url.searchParams.keys()],['WOPISrc']);
  assert.equal(url.searchParams.get('WOPISrc'),`${wopiOrigin}/api/meri/office/wopi/files/es-2`);
  assert.equal(form.fields.access_token_ttl,String(c.expiresAtMs));
  assert.deepEqual(codec.verify(form.fields.access_token,{fileId:'es-2'}),c);
  assert.ok(!form.actionUrl.includes(form.fields.access_token));
 }
 assert.throws(()=>launch.launch(claims,{format:'pdf'}),code('EDITOR_FORMAT_UNSUPPORTED'));
});
test('discovery rejects malformed XML, DTDs, ambiguous actions, redirects and credentials',()=>{
 for(const value of [Buffer.from('<wopi-discovery>'),Buffer.from('<!DOCTYPE a><wopi-discovery/>'),
  discovery(action()+action()),discovery(action('docx','edit','https://attacker.example/browser/x/cool.html?')),
  discovery(action('docx','edit','https://user:password@office.example.test/browser/x/cool.html?')),
  discovery(action('docx','edit','https://office.example.test/browser/x/cool.html?access_token=injected')),
  discovery(action('docx','edit','https://office.example.test/browser/x/cool.html?WOPISrc=injected')),
  Buffer.alloc(CODE_DISCOVERY_MAX_BYTES+1),Buffer.from([0xff])])
  assert.throws(()=>parseCodeDiscovery(value,{editorOrigin}),code('EDITOR_CODE_DISCOVERY'));
});
test('only actual external HTTPS actions count; readonly cannot fall back to edit',()=>{
 const forged=Buffer.from(`<wopi-discovery><net-zone name="internal-http"><app>${action()}</app></net-zone><!--${action()}--></wopi-discovery>`);
 assert.throws(()=>parseCodeDiscovery(forged,{editorOrigin}),code('EDITOR_CODE_DISCOVERY'));
 const codec=createWopiAccessTokenCodec({key:Buffer.alloc(32,9),now});
 const launch=createCollaboraCodeLaunch({editorOrigin,wopiOrigin,discoveryBytes:discovery(action()),codec,now});
 assert.throws(()=>launch.launch({...claims,userCanWrite:false},{format:'docx'}),code('EDITOR_CODE_ACTION_UNAVAILABLE'));
});
test('optional discovery placeholders are omitted and configured origins are exact HTTPS origins',()=>{
 const value=discovery(action('docx','edit','https://office.example.test/browser/x/cool.html?&lt;ui=UI_LLCC&amp;&gt;'));
 assert.equal(parseCodeDiscovery(value,{editorOrigin})['docx:edit'],`${editorOrigin}/browser/x/cool.html?`);
 for(const origin of ['http://office.example.test','https://office.example.test/','https://office.example.test?a=b','https://user@office.example.test'])
  assert.throws(()=>parseCodeDiscovery(bytes,{editorOrigin:origin}),code('EDITOR_CODE_CONFIGURATION'));
});
