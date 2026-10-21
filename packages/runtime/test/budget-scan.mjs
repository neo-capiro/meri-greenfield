/** Structural budget guard: exact sites are reviewed, never directory-wide exclusions. */
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

export const BUDGET_ROOTS = ['apps/runtime', 'apps/control', 'apps/worker/conversation', 'apps/proxy/product', 'apps/gateway/budget', 'packages/runtime'];
const sourceExtension = /\.(?:mjs|cjs|js|ts|py)$/u;
const testFile = /(?:^|\/)(?:test|tests|node_modules|__pycache__)(?:\/|$)|(?:[.-](?:test|spec|fixture)|^test_)|(?:\/test_[^/]+\.py$)/u;
const canonical = 'packages/runtime/hot-path-budgets.mjs';
const numericBudget = /\b([A-Za-z_$][\w$]*(?:Ms|Millis|Seconds|Timeout|Deadline|_MS|_SECONDS|_TIMEOUT|_DEADLINE)|timeout|poll\w*|[a-z_]\w*_(?:seconds|timeout|ms))\s*(?:[:=]|\?\?)\s*(\d[\d_]*(?:\.\d+)?)/gu;

export async function sourceFiles(root, roots=BUDGET_ROOTS) {
 const out=[];
 async function walk(relative) {
  let entries;try {entries=await readdir(path.join(root,relative),{withFileTypes:true});} catch(error) {if(error.code==='ENOENT')return;throw error;}
  for(const item of entries){const file=path.posix.join(relative,item.name);if(testFile.test(file))continue;if(item.isDirectory())await walk(file);else if(sourceExtension.test(file))out.push(file);}
 }
 for(const dir of roots)await walk(dir);return out.sort();
}

// Comments retain their original width/newlines so every diagnostic locates source exactly.
export function withoutComments(source, python=false) {
 let out='',i=0,quote=null;
 while(i<source.length){
  const char=source[i],next=source[i+1];
  if(quote){out+=char;i++;if(char==='\\'&&i<source.length){out+=source[i++];continue;}if(char===quote)quote=null;continue;}
  if(char==='"'||char==="'"||char==='`'){quote=char;out+=char;i++;continue;}
  if((python&&char==='#')||(!python&&char==='/'&&next==='/')){while(i<source.length&&source[i]!=='\n'){out+=' ';i++;}continue;}
  if(!python&&char==='/'&&next==='*'){out+='  ';i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/')){out+=source[i]==='\n'?'\n':' ';i++;}if(i<source.length){out+='  ';i+=2;}continue;}
  out+=char;i++;
 }
 return out;
}

export function literalSites(file, source) {
 const text=withoutComments(source,file.endsWith('.py')), out=[];
 for(const match of text.matchAll(numericBudget)){
  const value=Number(match[2].replaceAll('_',''));
  // Zero-valued timestamps/counters and single-digit arithmetic coefficients are not timers.
  if(!file.endsWith('.py')&&value<10)continue;
  const start=source.lastIndexOf('\n',match.index)+1,end=source.indexOf('\n',match.index);
  out.push({file,field:match[1],value,expression:match[0],site:source.slice(start,end<0?undefined:end).trim(),line:source.slice(0,match.index).split('\n').length});
 }
 return out;
}

export async function checkLiteralBudgets(root, allowlist) {
 const violations=[],used=new Map();
 for(const entry of allowlist){if(!entry.file||!entry.site||!entry.reason||!['qualification','validator','telemetry','pinned-library'].includes(entry.scope))violations.push(`invalid literal exception: ${JSON.stringify(entry)}`);}
 for(const file of await sourceFiles(root)){
  if(file===canonical)continue;
  const source=await readFile(path.join(root,file),'utf8');
  for(const site of literalSites(file,source)){
   const index=allowlist.findIndex(entry=>entry.file===file&&entry.site===site.site&&entry.field===site.field);
   if(index<0)violations.push(`${site.file}:${site.line} ${site.expression}`);
   else used.set(index,(used.get(index)??0)+1);
  }
 }
 for(let i=0;i<allowlist.length;i++)if((used.get(i)??0)!==allowlist[i].occurrences)violations.push(`stale/expanded exception ${allowlist[i].file} ${allowlist[i].field}: expected ${allowlist[i].occurrences}, found ${used.get(i)??0}`);
 return violations;
}

export function callExpressions(source, name) {
 const text=withoutComments(source),escaped=name.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
 const pattern=new RegExp(`(?<![\\w$])${escaped}\\s*\\)?\\s*\\(`,'gu'),out=[];
 for(const found of text.matchAll(pattern)){
  const open=text.indexOf('(',found.index),prefix=text.slice(Math.max(0,found.index-25),found.index);
  if(/(?:function\s+|class\s+)$/u.test(prefix))continue;
  let depth=1,quote=null,escapedCharacter=false,end=open+1;
  for(;end<text.length&&depth;end++){
   const c=text[end];if(quote){if(escapedCharacter)escapedCharacter=false;else if(c==='\\')escapedCharacter=true;else if(c===quote)quote=null;continue;}
   if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='(')depth++;else if(c===')')depth--;
  }
  out.push({text:source.slice(open+1,end-1),offset:found.index,line:source.slice(0,found.index).split('\n').length});
 }
 return out;
}

function escaped(value){return value.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');}

// Select the field value inside a call, including nested object fields; a budget
// for another option in the same constructor cannot satisfy this requirement.
function fieldValues(source, field){
 const out=[],pattern=new RegExp(`\\b${escaped(field)}\\s*:`,'gu');
 for(const found of source.matchAll(pattern)){
  let i=found.index+found[0].length,start=i,depth=0,quote=null;
  for(;i<source.length;i++){
   const c=source[i];if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
   if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
   if('([{'.includes(c)){depth++;continue;}if(')]}'.includes(c)){if(!depth)break;depth--;continue;}
   if(c===','&&!depth)break;
  }
  out.push(source.slice(start,i));
 }
 return out;
}

export async function checkRegisteredBudgets(root, registry) {
 const failures=[],sources=new Map();
 const read=async file=>{if(!sources.has(file)){try{sources.set(file,await readFile(path.join(root,file),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;failures.push(`${file}: missing registered source`);sources.set(file,'');}}return sources.get(file);};
 for(const entry of registry.constructors??[]){
  const source=withoutComments(await read(entry.file)),field=escaped(entry.field);
  if(!new RegExp(`\\b${escaped(entry.constructor)}\\b`,'u').test(source))failures.push(`${entry.file}: missing constructor ${entry.constructor}`);
  if(new RegExp(`\\b${field}\\s*(?:=|\\?\\?)\\s*\\d`,'u').test(source))failures.push(`${entry.file}: ${entry.constructor}.${entry.field} has a numeric default`);
  if(!entry.hop||!entry.calls?.length){failures.push(`${entry.file}: ${entry.constructor}.${entry.field} has no reviewed hop/call sites`);continue;}
  for(const call of entry.calls){
   const callee=Object.hasOwn(call,'constructor')?call.constructor:entry.constructor,rootSource=await read(call.file),expressions=callExpressions(rootSource,callee),selected=expressions.filter(expression=>!call.anchor||expression.text.includes(call.anchor));
   if(selected.length!==call.occurrences)failures.push(`${call.file}: expected ${call.occurrences} calls to ${callee}, found ${selected.length}`);
   if(call.source&&!call.sourceReason)failures.push(`${call.file}: derived/root source requires a reviewed reason`);
   for(const expression of selected){
    const trace=call.via?call.via.map(name=>{const match=new RegExp(`\\b${escaped(name)}\\s*=([\\s\\S]*?)(?:;|\\n)`,'u').exec(rootSource);return match?.[1]??'';}).join('\n'):'';
    const field=call.field??entry.field,values=fieldValues(expression.text,field),scope=expression.text+'\n'+trace,hop=call.hop??entry.hop;
    const lookup=new RegExp(`\\b(?:budget|fixedHotPathBudget)\\([^;]*?['"]${escaped(hop)}['"]\\s*\\)`,'u');
    const received=call.source?scope.includes(call.source):values.some(value=>lookup.test(value))||!!trace&&lookup.test(trace);
    if(!new RegExp(`\\b${escaped(field)}\\b`,'u').test(expression.text)||!received)failures.push(`${call.file}:${expression.line} ${entry.constructor}.${entry.field} must receive budget(table, '${hop}')${call.via?' through '+call.via.join(', '):''}`);
   }
  }
 }
 if(registry.libraries){
  const files=new Set([...(await sourceFiles(root)),...registry.libraries.map(entry=>entry.file)]);
  for(const file of files){
   const source=withoutComments(await read(file));
   const constructors=new Set([...source.matchAll(/\bnew\s+(Pool|ECSClient|EC2Client|S3Client|KMSClient|Agent|NodeHttpHandler)\s*\(/gu)].map(match=>match[1]));
   if(/\bNativeConnection\.connect\s*\(/u.test(source))constructors.add('NativeConnection.connect');
   if(/import\s*\{\s*createServer\s*\}\s*from\s*['"]node:(?:http|https)['"]/u.test(source)&&callExpressions(source,'createServer').length)constructors.add('createServer');
   for(const namespace of ['http','https','net'])if(callExpressions(source,namespace+'.createServer').length)constructors.add(namespace+'.createServer');
   for(const constructor of constructors){
    const registered=registry.libraries.find(entry=>entry.file===file&&entry.constructor===constructor);
    const exception=(registry.libraryExceptions??[]).find(entry=>entry.file===file&&entry.constructor===constructor);
    if(!registered&&!exception)failures.push(`${file}: unregistered library construction ${constructor}`);
   }
  }
  for(const entry of registry.libraryExceptions??[]){
   const calls=callExpressions(await read(entry.file),entry.constructor).filter(call=>call.text.includes(entry.anchor));
   if(entry.scope!=='qualification'||!entry.reason||!entry.anchor||calls.length!==entry.occurrences)failures.push(`${entry.file}: stale or invalid library exception ${entry.constructor}`);
  }
 }
 for(const entry of registry.libraries??[]){
  const source=await read(entry.file),calls=callExpressions(source,entry.constructor).filter(call=>!entry.anchor||call.text.includes(entry.anchor));
  if(calls.length!==entry.occurrences)failures.push(`${entry.file}: expected ${entry.occurrences} ${entry.constructor} clients, found ${calls.length}`);
  for(const call of calls){
   const start=entry.optionsSource?source.indexOf(entry.optionsSource.start):-1,end=entry.optionsSource?source.indexOf(entry.optionsSource.end,start):-1;
   const direct=entry.optionsSource?(start<0||end<0?'':source.slice(start,end+entry.optionsSource.end.length)):call.text;
   const forwarded=(entry.via??[]).map(name=>call.text.includes(name)?new RegExp(`\\b${escaped(name)}\\s*=([^;]+)`,'u').exec(source)?.[1]??'':'').join('\n');
   const scope=direct+'\n'+forwarded;
   if(entry.optionsSource&&!call.text.includes(entry.optionsSource.argument))failures.push(`${entry.file}:${call.line}: options do not reach ${entry.constructor}`);
   for(const option of entry.options)if(!new RegExp(`\\b${escaped(option)}\\s*:`,'u').test(scope))failures.push(`${entry.file}:${call.line} ${entry.constructor} missing explicit ${option}`);
   for(const [field,expression] of Object.entries(entry.tableExpressions??{}))if(!fieldValues(scope,field).some(value=>value.includes(expression)))failures.push(`${entry.file}:${call.line} ${entry.constructor}.${field} must use ${expression}`);
   for(const [field,hop] of Object.entries(entry.hops??{}))if(!fieldValues(scope,field).some(value=>new RegExp(`\\bbudget\\([^;]*?['"]${escaped(hop)}['"]\\s*\\)`,'u').test(value)))failures.push(`${entry.file}:${call.line} ${entry.constructor}.${field} must use ${hop}`);
  }
 }
 for(const entry of registry.assignments??[]){
  const source=withoutComments(await read(entry.file));
  if(!new RegExp(`${escaped(entry.target)}\\s*=\\s*budget\\([^;]*?['"]${escaped(entry.hop)}['"]\\s*\\)`,'u').test(source))failures.push(`${entry.file}: ${entry.target} must use ${entry.hop}`);
 }
 return failures;
}
