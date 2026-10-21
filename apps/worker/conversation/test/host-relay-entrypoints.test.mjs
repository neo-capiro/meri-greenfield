/** Inert entrypoint coverage is discovered by the existing worker test/*.test.mjs suite.
 * These child processes never receive a relay config or invoke a native helper. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for(const kind of ['host','local']){
 const entry=new URL(`../host/network/${kind}-relay-entry.mjs`,import.meta.url);
 const run=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:5000,windowsHide:true});
 test(`${kind} relay entrypoint imports without starting resources`,()=>{
  const result=run(['--input-type=module','--eval',`await import(${JSON.stringify(entry.href)})`]);
  assert.equal(result.error,undefined);assert.equal(result.status,0);
  assert.equal(result.stdout,'');assert.equal(result.stderr,'');
 });
 test(`${kind} relay entrypoint help is inert and documents exit codes`,()=>{
  const result=run([fileURLToPath(entry),'--help']);
  assert.equal(result.error,undefined);assert.equal(result.status,0);
  assert.match(result.stdout,/Usage:.*<base64url-json-config>/u);
  assert.match(result.stdout,/Exit: 0 clean stop, 2 invalid\/start failure, 3 cleanup failure/u);
  assert.equal(result.stderr,'');
 });
 test(`${kind} relay entrypoint refuses missing or malformed configuration before startup`,()=>{
  for(const args of [[],['!'],['e30']]){
   const result=run([fileURLToPath(entry),...args]);
   assert.equal(result.error,undefined);assert.equal(result.status,2);
   assert.equal(result.stdout,'');assert.match(result.stderr,/^HOST_NETWORK_(HOST|LOCAL)_RELAY_UNKNOWN\n$/u);
  }
 });
}
