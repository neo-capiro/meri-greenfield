// Ephemeral module-load mutant only. Never edits the candidate or reaches native resources.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const target=pathToFileURL(`${root}/apps/gateway/budget/tool-budget-outcome.mjs`).href;
registerHooks({load(url,context,nextLoad){
  const result=nextLoad(url,context);
  if(url!==target)return result;
  const source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8');
  const needle='!same(row.facts, invocation) ||';assert.equal(source.split(needle).length,2);
  return {...result,source:source.replace(needle,'')};
}});
