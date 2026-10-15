/** Suite inventory owner: loads suites.json, resolves each suite's test files, and accounts for every test file in a checkout
 * as covered by a suite or excluded with a reason. Import-safe: reads files only. */
import {globSync,readFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SUITES_SCHEMA='meri.local-baseline-suites.v1';
export const TEST_FILE_PATTERNS=['**/*.test.{mjs,js,cjs,ts,mts}','**/test_*.py','**/*_test.py'];
const here=dirname(fileURLToPath(import.meta.url));
const skipped=path=>/(^|\/)(node_modules|\.git)$/u.test(path);
const usage=message=>Object.assign(Error(message),{code:'USAGE'});

export function loadSuites(file=join(here,'suites.json')){
 const definitions=JSON.parse(readFileSync(file,'utf8'));
 if(definitions.schema!==SUITES_SCHEMA)throw usage('unknown suites schema');
 const names=definitions.suites.map(s=>s.name);
 if(new Set(names).size!==names.length)throw usage('duplicate suite name');
 for(const e of definitions.exclusions??[])if(!e.paths?.length||typeof e.reason!=='string'||!e.reason.trim())throw usage('an exclusion needs paths and a reason');
 return definitions;
}
const globFrom=(cwd,patterns)=>[...new Set(patterns.flatMap(pattern=>globSync(pattern,{cwd,exclude:skipped}).filter(f=>!/(^|\/)node_modules\//u.test(f))))].sort();
/** The files a node-test suite passes to `node --test`, relative to its cwd, in run order. */
export function suiteFiles(root,suite){return globFrom(resolve(root,suite.cwd??'.'),suite.files??[]);}
export function testFiles(root){return globFrom(root,TEST_FILE_PATTERNS);}

export function inventory(root,definitions=loadSuites()){
 const covered=new Map(),problems={uncovered:[],emptySuites:[],staleCovers:[],staleExclusions:[],excludedButCovered:[]};
 const cover=(file,name)=>{if(!covered.has(file))covered.set(file,[]);covered.get(file).push(name);};
 for(const suite of definitions.suites){
  if(suite.kind==='npm'){
   const prefix=suite.prefix??'.',scripts=Object.values(JSON.parse(readFileSync(join(root,prefix,'package.json'),'utf8')).scripts??{}).join('\n');
   if(!scripts.length)problems.emptySuites.push(suite.name);
   for(const pattern of suite.covers??[]){
    const files=globFrom(join(root,prefix),[pattern]);
    if(!files.length||!scripts.includes(pattern))problems.staleCovers.push(`${suite.name}: ${pattern}`);
    for(const file of files)cover(relative(root,join(root,prefix,file)),suite.name);
   }
  }else{
   const cwd=resolve(root,suite.cwd??'.'),files=suiteFiles(root,suite);
   if(!files.length)problems.emptySuites.push(suite.name);
   for(const file of files)cover(relative(root,join(cwd,file)),suite.name);
  }
 }
 const all=testFiles(root),known=new Set(all),excluded=new Map();
 for(const entry of definitions.exclusions??[]){
  const files=globFrom(root,entry.paths).filter(file=>known.has(file));
  if(!files.length)problems.staleExclusions.push(entry.paths.join(', '));
  for(const file of files){excluded.set(file,entry.reason);if(covered.has(file))problems.excludedButCovered.push(file);}
 }
 problems.uncovered=all.filter(file=>!covered.has(file)&&!excluded.has(file));
 return {testFiles:all,covered,excluded,...problems};
}
