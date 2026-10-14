/** Actual locked upstream bundler and canonical workerOptions; no Temporal connection or app start. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolveTemporal} from './temporal-binding.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
test('runtime-owned upstream Temporal bundles canonical workflow with no connections',async()=>{
  const http=await import('node:http'),https=await import('node:https'),net=await import('node:net'),tls=await import('node:tls');
  const originals=[globalThis.fetch,http.default.request,https.default.request,net.default.connect,net.default.createConnection,tls.default.connect,net.default.Server.prototype.listen];
  let attempts=0;const deny=()=>{attempts++;throw Error('QUALIFICATION_NETWORK_REFUSED');};
  globalThis.fetch=deny;http.default.request=deny;https.default.request=deny;net.default.connect=deny;net.default.createConnection=deny;tls.default.connect=deny;net.default.Server.prototype.listen=deny;
  try {
    const {entry,version}=resolveTemporal(root);
    assert.equal(version,'1.24.0');
    const {bundleWorkflowCode,DefaultLogger}=await import(pathToFileURL(entry).href);
    const {workerOptions}=await import('../../../apps/runtime/temporal-worker.mjs');
    const options=workerOptions({configuration:{temporal:{namespace:'synthetic-image-only',taskQueue:'synthetic-image-only'},limits:{shutdownMs:1000}},connection:{},native:{}});
    const bundle=await bundleWorkflowCode({workflowsPath:options.workflowsPath,logger:new DefaultLogger('ERROR',entry=>console.error(String(entry.message).slice(0,8000)))});
    assert.match(bundle.code,/meriConversationLifecycleWorkflow/);assert.ok(Buffer.byteLength(bundle.code)>0&&Buffer.byteLength(bundle.code)<=16*1024*1024);assert.equal(attempts,0);
  } finally {
    [globalThis.fetch,http.default.request,https.default.request,net.default.connect,net.default.createConnection,tls.default.connect,net.default.Server.prototype.listen]=originals;
  }
});
