import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
const root=new URL('../../../../',import.meta.url);
const codecUrl=new URL('apps/artifacts/edit-sessions/wopi-access-token.mjs',root).href;
const real=await import(codecUrl);
let retained,closeCalls=0,throwAfterClose=false;
mock.module(codecUrl,{exports:{...real,createWopiAccessTokenCodec(options){retained=real.createWopiAccessTokenCodec(options);return {...retained,close(){closeCalls++;retained.close();if(throwAfterClose)throw Error('SYNTHETIC_CLOSE_FAILURE');}};}}});
const {composeOffice}=await import(new URL('apps/runtime/artifacts/office-composition.mjs',root));
function assemble(key){return composeOffice({configuration:{limits:{requestMs:1000,requestBytes:1024},native:{maxResponseBytes:1024}},
 office:{enabled:true,keyFile:'/run/meri/office.key',serviceSecretFile:'/run/meri/core.secret',
  coreOrigin:'https://core.example.test',editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',
  browserOrigin:'https://app.example.test'},ports:{artifactOptionsOwner:{resolve(){throw Error('unused');}}},
 sessions:{nativeCredentialFor(){throw Error('unused');}},retention:{journal:{get(){throw Error('unused');}},
  serving:{isEnabled(){return true;}}},now:()=>1000,material:{key,discoveryBytes:Buffer.from('malformed discovery')}});}
for(const throwing of [false,true])test(`malformed discovery disposes copied codec and original material; close throws=${throwing}`,()=>{
 closeCalls=0;retained=undefined;throwAfterClose=throwing;const key=Buffer.alloc(32,7);
 try{
  assert.throws(()=>assemble(key));
  assert.equal(closeCalls,1);assert.ok(key.every(value=>value===0));
  assert.throws(()=>retained.issue({}),{code:'WOPI_TOKEN_CONFIGURATION'});
  assert.throws(()=>retained.verify('invalid',{fileId:'synthetic'}),{code:'WOPI_TOKEN_CONFIGURATION'});
 }finally{retained?.close();}
});
