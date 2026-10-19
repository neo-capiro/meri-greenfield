/** Offline scratch materialization only. Never fetches, installs, edits a source checkout or creates authority. */
import {readFile,writeFile,mkdir,readdir,mkdtemp,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isAbsolute,resolve,dirname,join,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
const packet=resolve(fileURLToPath(new URL('../',import.meta.url)));
const expectedBase='78ceaf9bdfe00c8f013aac15eb8483312ae4f803';
const target='apps/api/src/tenant/tenant-context.middleware.ts';
const usage='node scripts/prepare.mjs [--output /absolute/empty-scratch-dir] [--core-source-root /absolute/local-source-root]';
const args=process.argv.slice(2);if(args.includes('--help')){if(args.length!==1)throw Error(usage);console.log(usage);process.exit(0);}
let output,sourceRoot=join(packet,'source'),suppliedSource=false;
for(let i=0;i<args.length;i+=2){if(!['--output','--core-source-root'].includes(args[i])||typeof args[i+1]!=='string'||!isAbsolute(args[i+1]))throw Error(usage);if(args[i]==='--output'){if(output)throw Error(usage);output=resolve(args[i+1]);}else{if(suppliedSource)throw Error(usage);sourceRoot=resolve(args[i+1]);suppliedSource=true;}}
if(process.versions.node.split('.')[0]!=='24')throw Error('Use repository-supported Node 24; recorded evidence used 24.19.0.');
const manifest=JSON.parse(await readFile(join(packet,'source-manifest.json'),'utf8'));
if(manifest.baseCommit!==expectedBase||manifest.patch.target!==target)throw Error('Unexpected proposal source pin or target');
const safeRelative=path=>typeof path==='string'&&!isAbsolute(path)&&!path.split(/[\\/]/u).includes('..');
const hash=(kind,value)=>createHash(kind).update(value).digest('hex');
const blob=bytes=>hash('sha1',Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes]));
const verified=[];
for(const row of manifest.files){if(!safeRelative(row.path))throw Error('Unsafe source path');const bytes=await readFile(join(sourceRoot,row.path));if(hash('sha256',bytes)!==row.sha256||blob(bytes)!==row.gitBlob)throw Error('Published source bytes differ: '+row.path);verified.push({path:row.path,bytes});}
const patchPath=join(packet,'tenant-context.patch'),patch=await readFile(patchPath);if(hash('sha256',patch)!==manifest.patch.sha256)throw Error('Proposal patch hash differs');
const patchText=patch.toString('utf8');const paths=[...patchText.matchAll(/^(?:---|\+\+\+) [ab]\/(.+)$/gmu)].map(x=>x[1]);if(paths.length!==2||paths.some(path=>path!==target))throw Error('Patch must change the one approved proposal target only');
if(suppliedSource){try{await stat(join(sourceRoot,'.git'));const head=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim();if(head!==expectedBase)throw Error('Caller Git source must be at the exact published Core pin');}catch(error){if(error?.code!=='ENOENT')throw error;}}
if(!output)output=await mkdtemp(join(tmpdir(),'capiro-core-native-proposal-'));
const within=(parent,child)=>{const r=relative(parent,child);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
if(within(packet,output)||within(sourceRoot,output))throw Error('Output must be an independent scratch directory, outside packet/source');
try{await mkdir(output);}catch(error){if(error?.code!=='EEXIST')throw error;if((await readdir(output)).length!==0)throw Error('Output must be empty; never overwrite existing work');}
for(const row of verified){const destination=join(output,'baseline',row.path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,row.bytes);}
const proposed=join(output,'proposed',target);await mkdir(dirname(proposed),{recursive:true});await writeFile(proposed,verified.find(row=>row.path===target).bytes);
const env={...process.env};for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE'])delete env[key];
const options={cwd:join(output,'proposed'),env,stdio:'pipe'};execFileSync('git',['apply','--check',patchPath],options);execFileSync('git',['apply',patchPath],options);
if(hash('sha256',await readFile(proposed))!==manifest.patch.proposedSha256)throw Error('Applied proposal bytes differ');
const receipt={baseCommit:expectedBase,runRoot:output,verifiedSourceFiles:verified.length,proposalOnly:true,productionModified:false};
await writeFile(join(output,'materialization.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
