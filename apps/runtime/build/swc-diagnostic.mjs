/** Bounded failure classifications, never raw error messages, env values or mount sources. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

// Diagnostic authorization only: exact known native-loader messages, bounded and scrubbed.
export function exactNativeCauses(error) {
  const allowed=new Set(['MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ERR_SWC_NATIVE_CACHE','ERR_SWC_NATIVE_FORMAT','ERR_SWC_NATIVE_INTEGRITY','EACCES','EROFS','ENOENT']);
  const rows=[],seen=new Set();
  function visit(value,depth){
    if(!value||depth>4||rows.length>=8||seen.has(value))return;seen.add(value);
    if(Array.isArray(value)){for(const child of value)visit(child,depth);return;}
    if(allowed.has(value.code)&&typeof value.message==='string'){
      let message=value.message.split('\n')[0].slice(0,2048).replace(/[\u0000-\u001f\u007f]/g,' ');
      message=message.replace(/https?:\/\/\S+/gi,'<url>').replace(/\b(?:Bearer\s+\S+|(?:password|secret|token|credential)\s*[:=]\s*\S+)/gi,'<redacted>');
      message=message.replace(/\/(?:[^\s;,)'"\]]+)/g,p=>p==='/tmp'||p==='/home/node'||p.startsWith('/home/node/.cache')||p.startsWith('/opt/meri/')?p:'<path>');
      rows.push({code:value.code,message});
    }
    visit(value.cause,depth+1);
  }
  visit(error,0);return rows;
}

export function loaderCauses(error) {
  const rows=[],seen=new Set(),codes=new Set(['MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ERR_SWC_NATIVE_CACHE','ERR_SWC_NATIVE_FORMAT','ERR_SWC_NATIVE_INTEGRITY','EACCES','EROFS','ENOENT']);
  function visit(value,depth) {
    if(!value||depth>4||rows.length>=8||seen.has(value))return;
    seen.add(value);
    if(Array.isArray(value)){for(const item of value)visit(item,depth);return;}
    const message=typeof value.message==='string'?value.message.slice(0,8192):'';
    rows.push({code:codes.has(value.code)?value.code:'OTHER',classes:[
      [/cannot find module|cannot find package/i,'missing-module'],[/cache|materializ/i,'cache-materialization'],[/noexec/i,'noexec-mount'],[/read.only|EROFS/i,'read-only'],[/permission|access.*denied/i,'permission'],[/integrity|checksum|digest/i,'integrity'],[/ELF|invalid.*format|wrong.*class/i,'native-format'],[/shared.*library|cannot open shared object/i,'shared-library'],[/NODE_MODULE_VERSION|module version mismatch/i,'node-abi']
    ].filter(([pattern])=>pattern.test(message)).map(([,label])=>label)});
    visit(value.cause,depth+1);
  }
  visit(error,0);return rows;
}

export function mountSummary(text) {
  return text.split('\n').filter(Boolean).slice(0,4096).flatMap(line=>{
    const parts=line.split(' '),dash=parts.indexOf('-'),target=parts[4];
    if(dash<6||!['/','/tmp','/opt/meri'].includes(target))return [];
    const flags=parts[5].split(',').filter(v=>['rw','ro','noexec','nosuid','nodev'].includes(v));
    const type=parts[dash+1];
    return [{target,flags,type:['tmpfs','overlay','ext4','btrfs','xfs'].includes(type)?type:'other'}];
  }).slice(0,8);
}

export function swcDiagnostic(root,error,stage='native-temporal-bundle') {
  const header=process.report.getReport().header;
  const result={stage,rootCause:'unestablished',platform:process.platform,architecture:process.arch,glibcObserved:Boolean(header.glibcVersionRuntime),glibcVersionRuntime:/^\d+\.\d+(?:\.\d+)?$/.test(header.glibcVersionRuntime??'')?header.glibcVersionRuntime:null,causes:loaderCauses(error),exactNativeCauses:exactNativeCauses(error),inventory:[]};
  const runtimeRequire=createRequire(path.join(root,'apps/runtime/package.json'));
  let require=runtimeRequire;
  try{require=createRequire(fs.realpathSync(runtimeRequire.resolve('@swc/core/package.json')));}catch{}
  for(const name of ['@swc/core','@swc/core-linux-x64-gnu','@swc/core-linux-x64-musl']) {
    const row={package:name,resolved:false};
    try {
      const packageFile=fs.realpathSync(require.resolve(name+'/package.json'));
      const relative=path.relative(fs.realpathSync(root),packageFile);
      row.imageContained=relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);
      if(!row.imageContained){result.inventory.push(row);continue;}
      const pkg=JSON.parse(fs.readFileSync(packageFile,'utf8'));
      row.resolved=true;row.version=/^\d+\.\d+\.\d+$/.test(pkg.version)?pkg.version:'invalid';
      row.linux=Array.isArray(pkg.os)?pkg.os.includes('linux'):null;
      row.x64=Array.isArray(pkg.cpu)?pkg.cpu.includes('x64'):null;
      row.glibc=Array.isArray(pkg.libc)?pkg.libc.includes('glibc'):null;
      if(name!=='@swc/core'){
        const entry=fs.realpathSync(require.resolve(name));
        const inside=path.relative(path.dirname(packageFile),entry);
        if(inside!==''&&!inside.startsWith('..')&&!path.isAbsolute(inside)){
          const stat=fs.statSync(entry);row.regular=stat.isFile();row.bytes=stat.size;row.uid=stat.uid;row.gid=stat.gid;row.mode=(stat.mode&0o7777).toString(8);
          if(row.regular&&stat.size<=512*1024*1024){const bytes=fs.readFileSync(entry);row.sha256=crypto.createHash('sha256').update(bytes).digest('hex');row.format=bytes.length>=20&&bytes.subarray(0,4).equals(Buffer.from([127,69,76,70]))?'ELF':'other';if(row.format==='ELF'){row.elfClass=bytes[4];row.elfEndian=bytes[5];row.elfMachine=bytes.readUInt16LE(18);}}
        }
      }
    } catch(cause){row.causes=loaderCauses(cause);}
    result.inventory.push(row);
  }
  try{result.mounts=mountSummary(fs.readFileSync('/proc/self/mountinfo','utf8').slice(0,1024*1024));}catch{result.mountsUnavailable=true;}
  result.cacheConfiguration={custom:Boolean(process.env.SWC_NATIVE_BINDING_CACHE),xdg:Boolean(process.env.XDG_CACHE_HOME),homeUnderTmp:typeof process.env.HOME==='string'&&process.env.HOME.startsWith('/tmp/'),securitySkip:Boolean(process.env.SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK)};
  return result;
}
