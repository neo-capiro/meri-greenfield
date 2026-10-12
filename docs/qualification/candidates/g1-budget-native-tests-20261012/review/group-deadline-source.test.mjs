// Source-only assertions. Never imports/evaluates the integration entry or forks a child.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'explicit source root required');
const path='apps/gateway/test/postgres-budget.integration.mjs';
const ref=process.env.MERI_REVIEW_SOURCE_REF;
const source=ref?execFileSync('git',['-C',root,'show',`${ref}:${path}`],{encoding:'utf8'}):readFileSync(resolve(root,path),'utf8');
test('group cutoff fixed once before preparation and never extended',()=>{
  assert.equal(source.match(/deadline=Math\.min\(admission\.workDeadlineMs,Date\.now\(\)\+30000\)/g)?.length,1);
  assert.ok(source.indexOf('deadline=Math.min')<source.indexOf('const payloads=[]'));
  assert.equal(source.match(/\bdeadline\s*=/g)?.length,1);
});
test('closed group guard rechecks global and original group deadlines',()=>{
  assert.match(source,/const groupActive=\(\)=>\{active\(admission\);if\(Date\.now\(\)>=deadline\)throw Error\('CHILD_GROUP_DEADLINE'\);\};/);
});
test('each fork and each send has synchronous group admission',()=>{
  assert.match(source,/groupActive\(\);\s*const child=fork\(/);
  assert.match(source,/children\.forEach\(\(\{child\},n\)=>\{groupActive\(\);child\.send\(payloads\[n\]\);\}\)/);
});
test('early launch refusal cannot leave unhandled readiness rejection',()=>{
  assert.match(source,/record\.ready\.catch\(\(\)=>\{\}\);/);
  assert.match(source,/record\.done\.catch\(\(\)=>\{\}\);/);
  assert.match(source,/child\.once\('close',\(\)=>reject\(Error\('CHILD_CLOSED_BEFORE_READY'\)\)\)/);
});
