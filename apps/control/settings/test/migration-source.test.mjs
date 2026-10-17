/** Exact adoption of the allocated owner's settings migration; never applies DDL. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
test('reserved settings migration retains exact owner bytes and the historical settings schema body',async()=>{
 const raw=await readFile(new URL('../migrations/0001_settings.sql',import.meta.url));
 const blob=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(blob,'048a834c4335f97aa5f8691afc3c310188ec4388');
 const text=raw.toString('utf8'),proposal=await readFile(new URL('../../../../docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql',import.meta.url),'utf8');
 const body=value=>value.replace(/\r\n/gu,'\n').slice(value.replace(/\r\n/gu,'\n').indexOf('CREATE SCHEMA meri_settings;'));
 assert.equal(body(text),body(proposal));
 assert.doesNotMatch(text.replace(/--[^\n]*/gu,''),/\b(?:CREATE ROLE|ALTER ROLE|GRANT|REVOKE|INSERT|DROP|TRUNCATE)\b/u);
});
