// @ts-check
/** The live public-web producers are described and their failures explained to the model from one guidance owner,
 * over the frozen placeholder descriptors; every other read keeps its catalog-derived description. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {familyReads} from '../availability.mjs';
import {defineReadTool,MAX_DESCRIPTION} from '../tools.mjs';
import {failureResult,READ_FAILURE_CODES} from '../results.mjs';
import {READ_GUIDANCE,readGuidance} from '../guidance.mjs';
const row=id=>{const found=familyReads().find(r=>r.operation.id===id);assert.ok(found,id);return found;};
const describe=id=>defineReadTool(row(id),async()=>{throw Error('no call');},false).definition.description;

test('search_public_web tells the model the query bound, the row limit, the row shape and that dates may be absent',()=>{
 const text=describe('search_public_web'),d=row('search_public_web').descriptor;
 assert.ok(text.startsWith(`${d.displayName}. ${d.whenToUse}`),'the catalog head line is kept');
 assert.match(text,/1-200 characters/);assert.match(text,/refused, never truncated/);
 assert.match(text,/limit \(optional integer 1-12, default 6\)/);
 assert.match(text,/publishedAt \(publication date string, or null when the index has none\)/);
 assert.match(text,/title \(string or null\)/);assert.match(text,/url \(exact locator/);assert.match(text,/snippet \(string or null/);
 assert.match(text,/empty list is an honest empty discovery/);
 assert.doesNotMatch(text,/null handler|no enabled source|Pending private contract/,'the placeholder limitation never reaches the model');
 assert.match(text,/^Limits: Discovery only/mu);
 assert.ok(text.includes(d.inputSchema.sha256)&&text.includes('Supply literal arguments only'),'the canonical tail lines are kept');
 assert.match(text,/Covers: /);assert.match(text,/Returns: /);assert.match(text,/Result states: /);
 assert.ok(text.length<=MAX_DESCRIPTION,`${text.length} chars`);
});

test('scrape_web_page tells the model the URL, mode and size bounds, the result shape and the trust label',()=>{
 const text=describe('scrape_web_page');
 assert.match(text,/absolute http or https URL without credentials, at most 2000 characters/);
 assert.match(text,/"summary", the default, returns up to 4000 characters/);assert.match(text,/"extract" up to 12000/);
 assert.match(text,/maxChars \(optional integer 500-20000/);
 assert.match(text,/Only HTML\/XHTML and PDF are read/);assert.match(text,/external_untrusted/);
 assert.doesNotMatch(text,/null handler|no enabled source/);
 assert.match(text,/^Limits: The page reader refuses private, loopback/mu);
 assert.match(text,/Covers: /);assert.match(text,/Returns: /);assert.match(text,/Result states: /);
 assert.ok(text.length<=MAX_DESCRIPTION,`${text.length} chars`);
});

test('a read without operation guidance keeps its catalog identity and family description',()=>{
 const text=describe('search_congress_bills'),d=row('search_congress_bills').descriptor;
 assert.equal(readGuidance('search_congress_bills'),undefined);
 assert.ok(text.startsWith(`${d.displayName}. ${d.whenToUse}\nCovers: `));
 assert.match(text,/Returns: /);assert.match(text,/Result states: /);
 assert.ok(text.includes(d.inputSchema.sha256));
});

test('public-web failures carry a precise next step between the closed head and the evidence tail',()=>{
 for(const [tool,expected] of [['mcp__meri_reads__search_public_web',READ_GUIDANCE.search_public_web.failures],['mcp__meri_reads__scrape_web_page',READ_GUIDANCE.scrape_web_page.failures]]){
  for(const code of READ_FAILURE_CODES){
   const text=failureResult(code,tool).content[0].text;
   assert.ok(text.startsWith(`${code}: ${tool} `),text);
   assert.ok(text.endsWith(' No evidence, absence or completeness is established.'),text);
   if(Object.hasOwn(expected,code))assert.ok(text.includes(` ${expected[code]} No evidence`),`${tool} ${code}: ${text}`);
   else assert.equal(text,failureResult(code,'mcp__meri_reads__x').content[0].text.replace('mcp__meri_reads__x',tool));
  }
 }
 assert.match(failureResult('INVALID_ARGUMENTS','mcp__meri_reads__search_public_web').content[0].text,/1-200 characters and limit an integer 1-12/);
 assert.match(failureResult('UNAVAILABLE','mcp__meri_reads__search_public_web').content[0].text,/not configured, refused this search or reported an execution error/);
 assert.match(failureResult('INVALID_RESULT','mcp__meri_reads__scrape_web_page').content[0].text,/only HTML and PDF are read/);
 assert.equal(readGuidance('search_public_web'),READ_GUIDANCE.search_public_web);
 assert.equal(readGuidance('mcp__other_server__search_public_web'),READ_GUIDANCE.search_public_web,'guidance is keyed by the read, not the server');
});
