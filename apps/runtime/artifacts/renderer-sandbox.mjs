/** Fixed no-model child boundary in the existing ARM runtime image. Bubblewrap establishes the namespace; the canonical
 * renderer probe must observe every required restriction through this same runner before any conversion is admitted. */
import {realpath,lstat} from 'node:fs/promises';import {dirname,basename} from 'node:path';
import {runArtifactProcess} from '../../artifacts/process.mjs';import {officeTransformArguments} from '../../artifacts/office-transform.mjs';
import {RENDERER_PROBE_PATH,qualifyLibreOfficeRenderer} from '../../artifacts/renderer-qualification.mjs';
import {rendererFault} from './renderer-contract.mjs';
export const RENDERER_IMAGE_PATHS=Object.freeze({bwrap:'/usr/bin/bwrap',prlimit:'/usr/bin/prlimit',executable:'/usr/lib/libreoffice/program/soffice',nodeExecutable:'/usr/local/bin/node',tempRoot:'/tmp'});
/** The image is a closed allowlist. No host /run, /home, /workspace, parent /proc, socket, environment or credential mount. */
export function rendererSandboxArguments({executable,args,cwd}){
 const p=RENDERER_IMAGE_PATHS;if(dirname(cwd)!==p.tempRoot||!/^meri-(office|renderer-probe)-[A-Za-z0-9]{6}$/u.test(basename(cwd)))throw rendererFault('RENDERER_SANDBOX_REFUSED');
 const probe=executable===p.nodeExecutable&&JSON.stringify(args)===JSON.stringify([RENDERER_PROBE_PATH]);
 const version=executable===p.executable&&JSON.stringify(args)===JSON.stringify(['--version']);
 const transform=executable===p.executable&&['docx','xlsx','pptx'].some(format=>JSON.stringify(args)===JSON.stringify(officeTransformArguments({workspace:cwd,format,target:'pdf'})));
 if(!probe&&!version&&!transform)throw rendererFault('RENDERER_SANDBOX_REFUSED');
 return ['--unshare-all','--die-with-parent','--new-session','--uid','1000','--gid','1000','--cap-drop','ALL','--tmpfs','/',
  '--ro-bind','/usr','/usr','--ro-bind-try','/lib','/lib','--ro-bind-try','/lib64','/lib64','--ro-bind-try','/bin','/bin',
  '--dir','/etc','--ro-bind','/etc/fonts','/etc/fonts','--ro-bind-try','/etc/ld.so.cache','/etc/ld.so.cache',
  '--proc','/proc','--dev','/dev','--dir','/sys','--dir','/sys/fs','--ro-bind','/sys/fs/cgroup','/sys/fs/cgroup',
  '--dir','/opt','--dir','/opt/meri','--dir','/opt/meri/apps','--dir','/opt/meri/apps/artifacts',
  '--ro-bind',RENDERER_PROBE_PATH,RENDERER_PROBE_PATH,'--dir','/tmp','--bind',cwd,cwd,'--chdir',cwd,'--remount-ro','/',
  '--',p.prlimit,'--fsize=16777216:16777216','--nofile=128:128','--nproc=64:64','--',executable,...args];
}
export async function runRendererSandbox(executable,args,options){
 const p=RENDERER_IMAGE_PATHS,s=await lstat(options.cwd);
 if(process.platform!=='linux'||process.getuid?.()!==1000||s.isSymbolicLink()||!s.isDirectory()||s.uid!==1000||(s.mode&0o777)!==0o700||await realpath(options.cwd)!==options.cwd)throw rendererFault('RENDERER_SANDBOX_REFUSED');
 return runArtifactProcess(p.bwrap,rendererSandboxArguments({executable,args,cwd:options.cwd}),options);
}
export function qualifyRuntimeRenderer({imageDigest,deadlineMs,signal}){
 return qualifyLibreOfficeRenderer({...RENDERER_IMAGE_PATHS,imageDigest,qualificationId:'runtime-renderer-'+imageDigest.slice(7),deadlineMs,signal,
  credentialPaths:['/run/meri','/run/meri-temporal','/home/node/.aws/credentials','/workspace','/var/run/secrets'],run:runRendererSandbox});
}
