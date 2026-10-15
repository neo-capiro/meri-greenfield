/** Conditional source proposal. Never executes inspected ELF or invokes ldd.
 * A successful materialization proves a bounded file/dependency closure only;
 * it is not an image build, vulnerability decision or runtime qualification.
 */
import {open,readFile,readdir,lstat,realpath,mkdir,copyFile,chmod,chown,symlink,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const MAX_ELF_BYTES=256*1024*1024,MAX_FILES=250000,MAX_ELFS=4096;
const SONAMES=new Set(['libdl.so.2','libstdc++.so.6','libm.so.6','libgcc_s.so.1','libpthread.so.0','libc.so.6','librt.so.1','ld-linux-x86-64.so.2','libtinfo.so.6','libresolv.so.2','libnss_dns.so.2','libnss_files.so.2']);
const HELPERS=new Set(['/usr/bin/bash','/usr/bin/dash','/bin/sh','/bin/bash','/usr/bin/sh']);
const LIB_DIRS=new Set(['/lib/x86_64-linux-gnu','/usr/lib/x86_64-linux-gnu','/lib64','/usr/lib64','/usr/local/lib']);
const INTERPRETER='/lib64/ld-linux-x86-64.so.2';
const forbiddenName=name=>/^lib(?:z(?:\.so|$)|uuid\.|blkid\.|mount\.|smartcols\.|fdisk\.|lastlog2\.)/u.test(name);
const refuse=reason=>{throw Object.assign(Error('RUNTIME_ROOT_REFUSED: '+reason),{code:'RUNTIME_ROOT_REFUSED'});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fields(value,required,optional=[]){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))refuse('invalid policy fields');return value;}
function logical(value){if(typeof value!=='string'||!path.posix.isAbsolute(value)||value==='/'||path.posix.normalize(value)!==value||value.endsWith('/')||/[\\\x00-\x1f\x7f]/u.test(value)||value.length>4096)refuse('invalid absolute container path');return value;}
function inside(root,target){const relative=path.relative(root,target);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))refuse('path escaped trusted root');return target;}
function local(root,value){logical(value);return inside(root,path.join(root,...value.slice(1).split('/')));}
function range(bytes,offset,length){if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset>bytes.length-length)refuse('ELF range is out of bounds');}
function number(value){if(value>BigInt(Number.MAX_SAFE_INTEGER))refuse('ELF offset exceeds safe integer');return Number(value);}
function stringAt(bytes,offset,end,max=4096){range(bytes,offset,0);const limit=Math.min(end,offset+max),stop=bytes.indexOf(0,offset);if(stop<offset||stop>=limit)refuse('unterminated or oversized ELF string');let value;try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset,stop));}catch{refuse('invalid ELF string encoding');}if(!value||/[\x00-\x1f\x7f]/u.test(value))refuse('invalid ELF string');return value;}

/** ELF64 little-endian, x86_64 executable/shared-object reader with hard bounds.
 * Other architectures are reported explicitly and never treated as audited x64.
 */
export function inspectElf(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_ELF_BYTES)refuse('ELF byte limit');
 if(bytes.length<4||bytes[0]!==0x7f||bytes.toString('ascii',1,4)!=='ELF')return {kind:'non-elf'};
 if(bytes.length<20)refuse('truncated ELF header');const elfClass=bytes[4],endianness=bytes[5],machine=endianness===1?bytes.readUInt16LE(18):bytes.readUInt16BE(18);
 if(elfClass!==2||endianness!==1||machine!==62)return {kind:'other-architecture',elfClass,endianness,machine};
 range(bytes,0,64);if(bytes[6]!==1||bytes.readUInt32LE(20)!==1||bytes.readUInt16LE(52)!==64||![2,3].includes(bytes.readUInt16LE(16)))refuse('unsupported ELF64 header');
 const offset=number(bytes.readBigUInt64LE(32)),entrySize=bytes.readUInt16LE(54),count=bytes.readUInt16LE(56);
 if(entrySize!==56||count<1||count>256)refuse('ELF program-header limit');range(bytes,offset,entrySize*count);
 const loads=[],dynamic=[],interpreters=[];
 for(let i=0;i<count;i++){
  const p=offset+i*entrySize,type=bytes.readUInt32LE(p),fileOffset=number(bytes.readBigUInt64LE(p+8)),virtual=bytes.readBigUInt64LE(p+16),size=number(bytes.readBigUInt64LE(p+32)),memory=bytes.readBigUInt64LE(p+40);range(bytes,fileOffset,size);
  if(BigInt(size)>memory||virtual+memory>(1n<<64n)-1n)refuse('invalid ELF segment');
  if(type===1)loads.push({fileOffset,virtual,size});
  if(type===2)dynamic.push({fileOffset,size});
  if(type===3){if(size<2||size>4096)refuse('ELF interpreter length');const value=stringAt(bytes,fileOffset,fileOffset+size);if(Buffer.byteLength(value)+1!==size)refuse('ELF interpreter trailing bytes');interpreters.push(logical(value));}
 }
 if(dynamic.length>1||interpreters.length>1)refuse('ambiguous ELF dynamic/interpreter segments');
 const neededOffsets=[],values=new Map();
 if(dynamic.length){const d=dynamic[0];if(d.size%16!==0||d.size/16>4096)refuse('ELF dynamic-table limit');let terminated=false;
  for(let p=d.fileOffset;p<d.fileOffset+d.size;p+=16){const tag=bytes.readBigInt64LE(p),value=bytes.readBigUInt64LE(p+8);if(tag===0n){terminated=true;break;}if([0x6ffffefan,0x6ffffefbn,0x6ffffefcn,0x7ffffffdn,0x7fffffffn].includes(tag))refuse('unsupported ELF loader configuration/audit/filter tag');if(tag===1n){if(neededOffsets.length>=64)refuse('ELF dependency limit');neededOffsets.push(value);}else if([5n,10n,14n,15n,29n].includes(tag)){if(values.has(tag))refuse('duplicate ELF string-table tag');values.set(tag,value);}}
  if(!terminated)refuse('unterminated ELF dynamic table');
 }
 let readString;
 if(neededOffsets.length||[14n,15n,29n].some(tag=>values.has(tag))){
  if(!values.has(5n)||!values.has(10n))refuse('missing ELF dynamic string table');const address=values.get(5n),size=number(values.get(10n));if(size<1||size>4*1024*1024)refuse('ELF string-table limit');
  const matches=[...new Set(loads.filter(s=>address>=s.virtual&&address+BigInt(size)<=s.virtual+BigInt(s.size)).map(s=>s.fileOffset+number(address-s.virtual)))];if(matches.length!==1)refuse('unmapped or ambiguous ELF dynamic string table');const start=matches[0];range(bytes,start,size);
  readString=value=>{const index=number(value);if(index>=size)refuse('ELF string offset is out of bounds');return stringAt(bytes,start+index,start+size);};
 }
 const needed=neededOffsets.map(value=>readString(value));if(new Set(needed).size!==needed.length||needed.some(name=>!/^[A-Za-z0-9_.+-]{1,255}$/u.test(name)))refuse('invalid ELF dependency name');
 return {kind:'linux-x64-elf',needed,interpreter:interpreters[0]??null,soname:values.has(14n)?readString(values.get(14n)):null,rpath:values.has(15n)?readString(values.get(15n)):null,runpath:values.has(29n)?readString(values.get(29n)):null};
}

/** All hashes/paths/support choices require independent review. There is no
 * permissive default policy and no dependency search outside this finite list.
 */
export function validatePolicy(value){
 const p=fields(value,['schemaVersion','sourceImage','platform','files','libraries','packages','upstreamNode','dlopenReview','packagePolicy']);
 if(p.schemaVersion!==1||p.platform!=='linux/amd64'||!/^docker\.io\/library\/node@sha256:[a-f0-9]{64}$/u.test(p.sourceImage))refuse('verified official Docker Node image/platform required');
 if(!Array.isArray(p.files)||!p.files.length||p.files.length>512||!Array.isArray(p.packages)||!p.packages.length)refuse('bounded reviewed file/package inventory required');
 const entries=new Map();for(const entry of p.files){fields(entry,['path','role','owner'],['sha256','symlink']);logical(entry.path);if(entries.has(entry.path)||!['node','library','helper','support','license','inventory'].includes(entry.role)||((entry.sha256!==undefined)===(entry.symlink!==undefined))||typeof entry.owner!=='string'||forbiddenName(path.posix.basename(entry.path)))refuse('invalid or prohibited reviewed file');if(entry.sha256!==undefined&&!/^[a-f0-9]{64}$/u.test(entry.sha256))refuse('reviewed sha256 required');if(entry.symlink!==undefined&&(typeof entry.symlink!=='string'||!entry.symlink||/[\\\x00-\x1f\x7f]/u.test(entry.symlink)))refuse('invalid reviewed symlink');if(entry.role==='helper'&&!HELPERS.has(entry.path))refuse('unreviewed helper');if((/^\/(?:bin|sbin|usr\/bin|usr\/sbin)\//u.test(entry.path)||/^\/etc\/(?:shadow|gshadow)$/u.test(entry.path))&&!(entry.role==='helper'&&HELPERS.has(entry.path)))refuse('OS executable/credential files are forbidden');entries.set(entry.path,entry);}
 if(entries.get('/usr/local/bin/node')?.role!=='node'||entries.get('/var/lib/dpkg/status')?.role!=='inventory')refuse('explicit Node and truthful source package status required');
 if(entries.get('/usr/lib/os-release')?.owner!=='debian:base-files'||entries.get('/usr/lib/os-release')?.role!=='support'||entries.get('/etc/os-release')?.owner!=='debian:base-files'||entries.get('/etc/os-release')?.symlink!=='../usr/lib/os-release')refuse('exact Debian OS attribution files and owner required');
 fields(p.libraries,[] ,Object.keys(p.libraries));for(const [name,file]of Object.entries(p.libraries)){if(!SONAMES.has(name)||forbiddenName(name)||!entries.has(logical(file))||path.posix.basename(file)!==name||entries.get(file).role!=='library'||!LIB_DIRS.has(path.posix.dirname(file)))refuse('unreviewed library mapping or missing SONAME alias');}
 for(const entry of entries.values())if(entry.role==='library'&&!LIB_DIRS.has(path.posix.dirname(entry.path)))refuse('untrusted library directory');
 for(const entry of entries.values())if(entry.symlink!==undefined){const target=path.posix.resolve(path.posix.dirname(entry.path),entry.symlink);logical(target);if(!entries.has(target))refuse('symlink target is outside reviewed files');}
 fields(p.upstreamNode,['version','licenseFiles','bundledComponents']);if(!/^24\.\d+\.\d+$/u.test(p.upstreamNode.version)||!Array.isArray(p.upstreamNode.licenseFiles)||!p.upstreamNode.licenseFiles.length||!Array.isArray(p.upstreamNode.bundledComponents)||!p.upstreamNode.bundledComponents.length)refuse('Node version/license/bundled-component disclosure required');
 for(const pkg of p.packages){fields(pkg,['name','version','architecture','licenseFiles']);if(!/^[a-z0-9][a-z0-9+.-]*$/u.test(pkg.name)||typeof pkg.version!=='string'||!pkg.version||pkg.architecture!=='amd64'&&pkg.architecture!=='all'||!Array.isArray(pkg.licenseFiles)||!pkg.licenseFiles.length)refuse('invalid source package inventory');}
 const packageNames=new Set(p.packages.map(pkg=>'debian:'+pkg.name));if(packageNames.size!==p.packages.length)refuse('duplicate source package');for(const entry of entries.values()){if(entry.owner==='source-inventory'){if(entry.path!=='/var/lib/dpkg/status'||entry.role!=='inventory')refuse('invalid source-only inventory ownership');}else if(entry.owner==='upstream:node'){if(entry.path!=='/usr/local/bin/node'&&!p.upstreamNode.licenseFiles.includes(entry.path))refuse('unattributed upstream file');}else if(entry.owner==='image-generated:node-account-files'){if(entry.role!=='support'||!['/etc/passwd','/etc/group'].includes(entry.path))refuse('invalid image-generated account file');}else if(!packageNames.has(entry.owner))refuse('retained file source package is missing from inventory');}
 for(const file of [...p.upstreamNode.licenseFiles,...p.packages.flatMap(pkg=>pkg.licenseFiles)])if(entries.get(file)?.role!=='license')refuse('missing exact license file');
 fields(p.dlopenReview,['status','supportFiles','notes']);if(p.dlopenReview.status!=='reviewed'||!Array.isArray(p.dlopenReview.supportFiles)||!p.dlopenReview.notes||p.dlopenReview.supportFiles.some(file=>!['support','helper','library'].includes(entries.get(file)?.role)))refuse('explicit NSS/dlopen/TLS configuration review required');
 fields(p.packagePolicy,['status','notes']);if(!['HOLD','SOURCE_REVIEWED_ONLY'].includes(p.packagePolicy.status)||!p.packagePolicy.notes)refuse('explicit package-policy hold required');
 return p;
}
async function digestFile(file){const h=createHash('sha256'),handle=await open(file,'r');try{for await(const chunk of handle.createReadStream({autoClose:false}))h.update(chunk);return h.digest('hex');}finally{await handle.close();}}
async function elfFile(file){const handle=await open(file,'r');try{const header=Buffer.alloc(64),{bytesRead}=await handle.read(header,0,64,0);if(bytesRead<4||header[0]!==0x7f||header.toString('ascii',1,4)!=='ELF')return {kind:'non-elf'};const stat=await handle.stat();if(stat.size>MAX_ELF_BYTES)refuse('ELF file exceeds byte limit');return inspectElf(await handle.readFile());}finally{await handle.close();}}
export function enforceElf(info,where,policy){if(info.kind!=='linux-x64-elf')refuse('unsupported OS ELF: '+where);if(forbiddenName(path.posix.basename(where))||info.soname&&forbiddenName(info.soname))refuse('retained zlib/util-linux ELF: '+where);if(info.interpreter!==null&&info.interpreter!==INTERPRETER)refuse('unreviewed interpreter: '+where);if(info.rpath!==null||info.runpath!==null)refuse('RPATH/RUNPATH requires separate review: '+where);for(const name of info.needed){if(forbiddenName(name))refuse('zlib/util-linux dependency: '+name);if(!SONAMES.has(name)||!Object.hasOwn(policy.libraries,name))refuse('unexpected DT_NEEDED: '+name);}return info;}

export async function materializeRuntimeRoot({baseRoot='/',appRoot='/opt/meri',output,policy,sourceImage}){
 if(process.platform!=='linux'||process.arch!=='x64')refuse('Linux x64 build host required');validatePolicy(policy);
 if(sourceImage!==policy.sourceImage)refuse('Docker source image argument differs from reviewed policy');
 const base=await realpath(baseRoot),app=await realpath(appRoot),destination=path.resolve(output);if(destination!=='/runtime-root'||app===path.parse(app).root||destination===base||destination===app)refuse('reserved /runtime-root output required');
 const relative=path.relative(app,destination);if(relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))refuse('output must be outside application root');
 const entries=new Map(policy.files.map(entry=>[entry.path,entry])),verified=new Map(),sourceInventory=[];
 // Validate every reviewed file before creating output; no wildcard OS copies.
 for(const entry of entries.values()){
  const input=local(base,entry.path),resolved=inside(base,await realpath(input)),stat=await lstat(input);
  if(entry.symlink!==undefined){if(!stat.isSymbolicLink())refuse('expected source symlink: '+entry.path);const {readlink}=await import('node:fs/promises');if(await readlink(input)!==entry.symlink)refuse('source symlink changed: '+entry.path);verified.set(entry.path,{entry,input,resolved});}
  else{if(!stat.isFile()||stat.isSymbolicLink()||await digestFile(input)!==entry.sha256)refuse('reviewed file digest/type changed: '+entry.path);verified.set(entry.path,{entry,input,resolved,mode:stat.mode&0o111?0o555:0o444});}
 }
 const osRelease=await readFile(verified.get('/usr/lib/os-release').input,'utf8');if(!/^ID=(?:debian|"debian")$/mu.test(osRelease)||!/^VERSION_ID=(?:13|"13")$/mu.test(osRelease))refuse('source distribution must remain positively attributed to Debian 13');
 const status=await readFile(verified.get('/var/lib/dpkg/status').input,'utf8'),records=status.split(/\n\n+/u).map(block=>({block: block.trim(),fields:Object.fromEntries(block.split('\n').filter(line=>/^[A-Za-z][A-Za-z-]*: /u.test(line)).map(line=>{const colon=line.indexOf(': ');return [line.slice(0,colon),line.slice(colon+2)];}))})),selectedStatus=[];
 for(const pkg of policy.packages){const found=records.find(row=>row.fields.Package===pkg.name&&row.fields.Architecture===pkg.architecture),record=found?.fields;if(!record||record.Version!==pkg.version||record.Status!=='install ok installed')refuse('source package metadata mismatch: '+pkg.name);const payloadFiles=policy.files.filter(file=>file.owner==='debian:'+pkg.name).map(file=>file.path);sourceInventory.push({name:record.Package,version:record.Version,architecture:record.Architecture,source:record.Source??record.Package,licenseFiles:pkg.licenseFiles,payloadFiles,payloadScope:'partial-reviewed-files'});selectedStatus.push(found.block+'\nX-Meri-Payload-Scope: partial-reviewed-files\n');
  let listed;for(const name of [pkg.name+':'+pkg.architecture,pkg.name]){try{const list=local(base,'/var/lib/dpkg/info/'+name+'.list');inside(base,await realpath(list));const content=await readFile(list,'utf8');if(content.length>4*1024*1024)refuse('package file-list limit');listed=content.split('\n');break;}catch(error){if(error.code!=='ENOENT')throw error;}}if(!listed)refuse('source package file ownership list missing: '+pkg.name);
  for(const file of payloadFiles){let owned=false;for(const candidate of listed.filter(item=>path.posix.basename(item)===path.posix.basename(file))){try{if(inside(base,await realpath(local(base,candidate)))===verified.get(file).resolved){owned=true;break;}}catch(error){if(error.code!=='ENOENT')throw error;}}if(!owned)refuse('source package does not own retained file: '+file);}
 }
 const audited=[],skipped=[],seen=new Set();let fileCount=0;
 async function walk(directory,depth=0){if(depth>64)refuse('application directory depth limit');for(const item of await readdir(directory,{withFileTypes:true})){if(++fileCount>MAX_FILES)refuse('application file count limit');const file=path.join(directory,item.name),relative=path.relative(app,file).split(path.sep).join('/');if(item.isSymbolicLink()){inside(app,await realpath(file));continue;}if(item.isDirectory()){await walk(file,depth+1);continue;}if(!item.isFile())refuse('special application file');const info=await elfFile(file);if(info.kind==='non-elf')continue;if(audited.length+skipped.length>=MAX_ELFS)refuse('application ELF count limit');if(info.kind==='other-architecture'){skipped.push({path:'/opt/meri/'+relative,...info});continue;}audited.push({path:'/opt/meri/'+relative,...enforceElf(info,relative,policy)});}}
 await walk(app);
 const required=new Set(['/usr/local/bin/node',...policy.files.filter(entry=>entry.role!=='library').map(entry=>entry.path),...policy.dlopenReview.supportFiles]);
 for(const file of required){const info=await elfFile(verified.get(file).resolved);if(info.kind!=='non-elf')audited.push({path:file,...enforceElf(info,file,policy)});}
 const queue=[...audited];
 while(queue.length){const info=queue.shift();for(const name of info.needed){const file=policy.libraries[name];if(seen.has(file))continue;seen.add(file);required.add(file);const checked=verified.get(file),library=enforceElf(await elfFile(checked.resolved),file,policy);if(library.soname!==null&&library.soname!==name)refuse('SONAME mapping mismatch: '+name);audited.push({path:file,...library});queue.push(library);}if(info.interpreter!==null&&!seen.has(info.interpreter)){if(!verified.has(info.interpreter))refuse('interpreter missing from reviewed files');seen.add(info.interpreter);required.add(info.interpreter);const interpreter=enforceElf(await elfFile(verified.get(info.interpreter).resolved),info.interpreter,policy);audited.push({path:info.interpreter,...interpreter});queue.push(interpreter);}}
 const expand=file=>{const entry=entries.get(file);if(entry.symlink!==undefined){const target=path.posix.resolve(path.posix.dirname(file),entry.symlink);if(!required.has(target)){required.add(target);expand(target);}}};for(const file of [...required])expand(file);
 for(const pkg of sourceInventory){pkg.payloadFiles=pkg.payloadFiles.filter(file=>required.has(file));if(!pkg.payloadFiles.length)refuse('selected package has no retained payload: '+pkg.name);}
 // Output must be new or empty, with a real parent; no preexisting symlink tree.
 const parent=await realpath(path.dirname(destination));inside(parent,destination);let existing;try{existing=await lstat(destination);}catch(error){if(error.code!=='ENOENT')throw error;}if(existing&&(existing.isSymbolicLink()||!existing.isDirectory()||(await readdir(destination)).length))refuse('output must be an empty real directory');await mkdir(destination,{recursive:false,mode:0o755}).catch(error=>{if(error.code!=='EEXIST')throw error;});
 const files=[];
 for(const file of [...required].sort()){
  const checked=verified.get(file),entry=checked.entry;
  // Keep raw source-package inventory visibly separate from the payload manifest;
  // it describes the source base, including deliberately excluded packages.
  if(file==='/var/lib/dpkg/status')continue;const targetPath=file,target=local(destination,targetPath);await mkdir(path.dirname(target),{recursive:true,mode:0o755});
  if(entry.symlink!==undefined){const resolved=path.posix.resolve(path.posix.dirname(file),entry.symlink),rewritten=path.posix.relative(path.posix.dirname(targetPath),resolved);await symlink(rewritten,target);files.push({path:targetPath,role:entry.role,owner:entry.owner,sourcePath:file,sourceSymlink:entry.symlink,symlink:rewritten});}
  else{await copyFile(checked.input,target,constants.COPYFILE_EXCL);await chmod(target,checked.mode);if(await digestFile(target)!==entry.sha256)refuse('copied file digest changed');files.push({path:targetPath,sourcePath:file,role:entry.role,owner:entry.owner,sha256:entry.sha256});}
 }
 await mkdir(local(destination,'/var/lib/dpkg'),{recursive:true,mode:0o755});const payloadStatus=selectedStatus.join('\n');await writeFile(local(destination,'/var/lib/dpkg/status'),payloadStatus,{flag:'wx',mode:0o444});files.push({path:'/var/lib/dpkg/status',role:'generated-payload-inventory',sha256:sha(Buffer.from(payloadStatus))});await writeFile('/runtime-root.source-dpkg-status',status,{flag:'wx',mode:0o444});
 await mkdir(local(destination,'/home/node'),{recursive:true,mode:0o750});await chmod(local(destination,'/home/node'),0o750);await chown(local(destination,'/home/node'),1000,1000);await mkdir(local(destination,'/tmp'),{mode:0o1777});await chmod(local(destination,'/tmp'),0o1777);await chown(local(destination,'/tmp'),0,0);
 const manifest={schemaVersion:1,qualification:'UNBUILT_UNSCANNED_NOT_APPROVED',sourceImage:policy.sourceImage,platform:policy.platform,policySha256:sha(Buffer.from(JSON.stringify(policy))),distribution:{id:'debian',versionId:'13',sourcePath:'/usr/lib/os-release',sha256:entries.get('/usr/lib/os-release').sha256},files,generatedDirectories:[{path:'/home/node',uid:1000,gid:1000,mode:'0750'},{path:'/tmp',uid:0,gid:0,mode:'1777'}],sourcePackages:sourceInventory,rawSourcePackageInventory:{path:'/runtime-root.source-dpkg-status',placement:'build-stage-sidecar-not-final-payload',sha256:sha(Buffer.from(status))},upstreamNode:policy.upstreamNode,packagePolicy:policy.packagePolicy,dlopenReview:policy.dlopenReview,auditedElf:audited,skippedOtherArchitectureElf:skipped,applicationCopy:'Separate Dockerfile COPY /opt/meri; audit did not copy or execute application files',limitations:['DT_NEEDED does not disclose statically bundled zlib or other components; upstream inventory and vulnerability review remain required.','Image scanner must independently identify Debian 13; unknown-OS zero findings cannot establish the vulnerability gate.','NSS/dlopen/TLS/timezone/user identity support is a separately reviewed finite policy, not inferred by this reader.','Home/tmp ownership does not grant writes under a read-only root; approved writable mounts are still required.','Artifact executor images and other placements are outside this Node-root closure.']};
 await mkdir(local(destination,'/usr/share/meri'),{recursive:true,mode:0o755});await writeFile(local(destination,'/usr/share/meri/runtime-root-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o444});return manifest;
}

async function main(args){if(args.length===1&&args[0]==='--help'){process.stdout.write('Usage: node materialize-runtime-root.mjs --source-image IMAGE@sha256:DIGEST --output PATH --policy FILE [--base-root PATH] [--app-root PATH]\nDefaults: base-root /, app-root /opt/meri. Requires reviewed pinned-image policy; does not build or qualify an image.\n');return;}const names=new Map([['--base-root','baseRoot'],['--app-root','appRoot'],['--output','output'],['--policy','policyFile'],['--source-image','sourceImage']]),options={};for(let i=0;i<args.length;i+=2){const key=names.get(args[i]);if(!key||!args[i+1]||Object.hasOwn(options,key))refuse('invalid CLI arguments');options[key]=args[i+1];}if(!options.policyFile||!options.output||!options.sourceImage)refuse('policy, output and source-image arguments required');const policy=JSON.parse(await readFile(options.policyFile,'utf8'));const manifest=await materializeRuntimeRoot({baseRoot:options.baseRoot,appRoot:options.appRoot,output:options.output,sourceImage:options.sourceImage,policy});process.stdout.write(JSON.stringify({qualification:manifest.qualification,files:manifest.files.length,auditedElf:manifest.auditedElf.length,skippedOtherArchitectureElf:manifest.skippedOtherArchitectureElf.length})+'\n');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{process.stderr.write((error.code==='RUNTIME_ROOT_REFUSED'?error.message:'RUNTIME_ROOT_REFUSED: materialization failed')+'\n');process.exitCode=1;});
