import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readLocalActionAdmission,migrationPaths} from './admission.mjs';
const root=new URL('../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
async function privateInput(t){
 const dir=await mkdtemp(join(tmpdir(),'meri-identity-review-'));t.after(()=>rm(dir,{recursive:true,force:true}));const at=Date.now(),migrationSha256={};
 for(const [name,path]of Object.entries(migrationPaths))migrationSha256[name]=sha(await readFile(new URL(path,root)));
 const value={schema:'meri-local-action-input/1',migrationSha256,native:{host:'127.0.0.1',port:54329,database:'meri_qualification_test',user:'qualification_owner',password:'SYNTHETIC_UNUSED',systemIdentifier:'123456789',serverStartTime:new Date(at-1000).toISOString(),serverVersion:'170011',t0Ms:at,workDeadlineMs:at+720000,cleanupDeadlineMs:at+900000,migrationSha256:migrationSha256.budget,stateLockSha256:sha(await readFile(new URL('apps/control/qualification-sdk-fixture/state/package-lock.json',root)))}};
 const raw=JSON.stringify(value),path=join(dir,'input.json');await writeFile(path,raw,{mode:0o600});return{dir,path,sha256:sha(raw),now:()=>at};
}
test('local CLI independent: inherited native admission refuses ambient PGOPTIONS before driver/pool access',async t=>{
 const f=await privateInput(t),old=process.env.PGOPTIONS;
 const clean=await readLocalActionAdmission({path:f.path,sha256:f.sha256,now:f.now});assert.equal(clean.descriptor.host,'127.0.0.1');
 process.env.PGOPTIONS='-c statement_timeout=0';
 try{await assert.rejects(readLocalActionAdmission({path:f.path,sha256:f.sha256,now:f.now}),/LOCAL_ACTION_ADMISSION_REQUIRED/);}
 finally{if(old===undefined)delete process.env.PGOPTIONS;else process.env.PGOPTIONS=old;}
});
test('local CLI independent: missing private input cannot touch existing output or disclose its supplied path',async t=>{
 const f=await privateInput(t),out=join(f.dir,'existing-output.json');await writeFile(out,'unchanged');
 const cli=fileURLToPath(new URL('cli.mjs',import.meta.url)),missing=join(f.dir,'MISSING_PRIVATE_PATH');
 const r=spawnSync(process.execPath,[cli,'--config',missing,'--config-sha256','a'.repeat(64),'--output',out],{encoding:'utf8',timeout:3000,maxBuffer:32768});
 assert.equal(r.status,2);assert.equal(await readFile(out,'utf8'),'unchanged');assert.ok(!(r.stdout+r.stderr).includes(missing));
});
test('local CLI independent: help and malformed argv finish without an admitted fixture',()=>{
 const cli=fileURLToPath(new URL('cli.mjs',import.meta.url));
 for(const [args,status]of [[['--help'],0],[['--config','x','--config','y','--output','z'],2],[[],2]]){
  const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:3000,maxBuffer:32768});assert.equal(r.status,status);assert.equal(r.signal,null);
 }
});
