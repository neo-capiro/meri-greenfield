/** Portable per-suite receipts: what ran (exact argv, cwd, selectors), where (source, Node, UID) and what it produced (counts,
 * failing names with first error lines, output hashes). Receipts never contain environment values other than the named
 * MERI_* fixture selectors; scrubbed variables are listed by name only. */
import {createHash} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';

export const RECEIPT_SCHEMA='meri.local-baseline-suite-receipt.v1';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Parse Node spec reporter output. An npm script may run several `node --test` processes: summaries are summed and every
 * failing-tests section is read. A failure is a `✖` line directly after its `test at <location>` line. */
export function parseSpecOutput(text){
 const counts={};
 for(const key of ['tests','suites','pass','fail','cancelled','skipped','todo'])for(const m of text.matchAll(new RegExp('^ℹ '+key+' (\\d+)$','gmu')))counts[key]=(counts[key]??0)+Number(m[1]);
 const failures=[],lines=text.split('\n');let inSection=false,previous='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/^✖ failing tests:/u.test(line)){inSection=true;previous='';continue;}
  if(!line.trim())continue;
  const m=inSection&&/^test at /u.test(previous)?/^✖ (.*?)(?: \((\d+(?:\.\d+)?)ms\))?$/u.exec(line):null;
  if(m){let detail=null;for(let j=i+1;j<lines.length&&!/^(✖|test at )/u.test(lines[j]);j++){const t=lines[j].trim();if(t&&!/^\}$/u.test(t)){detail=t.slice(0,300);break;}}failures.push({name:m[1],detail});}
  previous=line;
 }
 return {counts,failures};
}

export function suiteReceipt({suite,source,host,selectors,invocation,outcome,outputs}){
 return {schema:RECEIPT_SCHEMA,suite:{name:suite.name,purpose:suite.purpose??null,kind:suite.kind??'node-test',knownHostRequirements:suite.knownHostRequirements??[]},
  source,host,selectors,invocation,outcome,outputs};
}

export function writeSuiteReceipt(out,receipt){
 const dir=join(out,'receipts');mkdirSync(dir,{recursive:true});
 const file=join(dir,receipt.suite.name+'.json');writeFileSync(file,JSON.stringify(receipt,null,1)+'\n');return file;
}

/** SHA256SUMS over every receipt/output file in `out` (not the scratch tree), in `sha256sum -c` format. */
export function writeChecksums(out,{skip=['scratch']}={}){
 const files=[];const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name),rel=relative(out,path);
  if(skip.includes(rel)||rel==='SHA256SUMS')continue;if(entry.isDirectory())walk(path);else if(entry.isFile())files.push(rel);}};
 walk(out);files.sort();
 const text=files.map(rel=>`${sha256(readFileSync(join(out,rel)))}  ${rel}`).join('\n')+'\n';
 writeFileSync(join(out,'SHA256SUMS'),text);return files.length;
}
