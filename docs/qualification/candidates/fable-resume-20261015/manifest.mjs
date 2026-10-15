/** Writes MANIFEST.sha256.json for this candidate directory: every Git-tracked file with its size and SHA-256 and the retrieval route at a given commit. Usage: node manifest.mjs <commit> */
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),commit=process.argv[2]??'HEAD',rows=[];
// Only deliberately tracked deliverables: files Git knows about in this directory (staged or committed), never untracked or ignored local files.
const tracked=execFileSync('git',['ls-files','--cached','--','.'],{cwd:here,encoding:'utf8'}).split('\n').filter(Boolean).sort();
for(const rel of tracked){if(rel==='MANIFEST.sha256.json')continue;const bytes=readFileSync(join(here,rel));rows.push({path:rel,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const base='https://raw.githubusercontent.com/neo-capiro/meri-greenfield/'+commit+'/docs/qualification/candidates/fable-resume-20261015/';
writeFileSync(join(here,'MANIFEST.sha256.json'),JSON.stringify({schema:'meri.candidate-file-manifest.v1',commit,retrieval:{route:'public repository, no credential needed',urlPrefix:base,verify:'sha256sum of the fetched file must equal sha256 below'},files:rows},null,1)+'\n');
console.log(rows.length+' files');
