/** Skill assets use the existing catalog owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {skillsDigest} from './read-assets.mjs';
import assets from '../../../packages/skills/assets.json' with {type:'json'};
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
test('skill assets are verified through the existing catalog owner',async()=>{
 const result=await skillsDigest({root});
 assert.match(result.digest,/^[a-f0-9]{64}$/u);assert.ok(result.count>0);
 assert.equal(result.catalogSha256,assets.catalogSha256);
});
