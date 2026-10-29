import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {generateSelectedTabContracts} from '../generate-selected-tab.mjs';
test('generated browser receiver is deterministic, portable and byte-identical in extension source',async()=>{
 await generateSelectedTabContracts({check:true});
 const source=await readFile(new URL('../dist/selected-tab-application.mjs',import.meta.url),'utf8');
 assert.equal(await readFile(new URL('../../../apps/browser-extension/selected-tab/contract.mjs',import.meta.url),'utf8'),source);
 const context=vm.createContext({TextEncoder,TextDecoder,crypto:globalThis.crypto});
 const module=new vm.SourceTextModule(source,{context});await module.link(()=>{throw Error('External dependency');});await module.evaluate();
 assert.equal(module.namespace.SELECTED_TAB_SCHEMA,'meri.selected-tab/1');
 assert.equal(vm.runInContext('typeof process',context),'undefined');assert.equal(vm.runInContext('typeof Buffer',context),'undefined');
});
test('extension manifest grants only explicit selected-tab text capture and one exact recipient origin',async()=>{
 const m=JSON.parse(await readFile(new URL('../../../apps/browser-extension/selected-tab/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(m.permissions,['activeTab','scripting']);assert.equal(m.host_permissions,undefined);assert.equal(m.content_scripts,undefined);
 assert.equal(m.web_accessible_resources,undefined);assert.equal(m.externally_connectable.ids,undefined);
 assert.deepEqual(m.externally_connectable.matches,['https://portfolio-preview.app.capiro.ai/*']);
 assert.match(m.content_security_policy.extension_pages,/connect-src 'none'/u);
});
