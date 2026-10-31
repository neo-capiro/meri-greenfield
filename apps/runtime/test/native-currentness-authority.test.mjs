/** Real native client, route, store and canonical producer; only fixture TLS/SQL/execution/Core boundaries inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,CUSTODY,DECLARATION,POLICY} from '../native-processing-host/currentness-fixture.mjs';
const input=custody=>({custody,declaration:DECLARATION,policySha256:POLICY,deadlineMs:Date.now()+3000});
test('native authority: deleted saved upload is refused by actual inspection currentness wire',async()=>{
 const c=await compose();c.removeUpload();
 try{await assert.rejects(c.native.readNativeCurrentness(input(CUSTODY)));}finally{await c.native.close();}
});
test('native authority: changed custody record digest is refused against actual saved upload',async()=>{
 const c=await compose();
 try{await assert.rejects(c.native.readNativeCurrentness(input({...CUSTODY,recordSha256:'0'.repeat(64)})));}
 finally{await c.native.close();}
});
test('native authority: a fresh read refuses deletion after an earlier valid inspection read',async()=>{
 const c=await compose();
 try{const first=await c.native.readNativeCurrentness(input(CUSTODY));assert.equal(first.phase,'active');
  c.removeUpload();await assert.rejects(c.native.readNativeCurrentness(input(CUSTODY)));}
 finally{await c.native.close();}
});
