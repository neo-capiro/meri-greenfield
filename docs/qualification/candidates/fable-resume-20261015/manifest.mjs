/** Writes MANIFEST.sha256.json for this candidate directory: every file with its size and SHA-256 and the retrieval route at a given commit. Usage: node manifest.mjs <commit> */
import {readdirSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),commit=process.argv[2]??'HEAD',rows=[];
const walk=d=>{for(const name of readdirSync(d).sort()){const p=join(d,name);if(statSync(p).isDirectory())walk(p);else if(name!=='MANIFEST.sha256.json'){const bytes=readFileSync(p);rows.push({path:relative(here,p),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}};
walk(here);
const base='https://raw.githubusercontent.com/neo-capiro/meri-greenfield/'+commit+'/docs/qualification/candidates/fable-resume-20261015/';
writeFileSync(join(here,'MANIFEST.sha256.json'),JSON.stringify({schema:'meri.candidate-file-manifest.v1',commit,retrieval:{route:'public repository, no credential needed',urlPrefix:base,verify:'sha256sum of the fetched file must equal sha256 below'},files:rows},null,1)+'\n');
console.log(rows.length+' files');
