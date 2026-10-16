/** Linux task workspace writer. A pinned directory fd prevents parent/symlink retargeting; an existing file refuses. */
import {open,realpath,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {OBJECTIVE_DRAFT_PATH,assertTypedResultBytes,typedFault} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export async function writeObjectiveResultFile({cwd,bytes,descriptor,signal}){
 nativeSignal(signal);
 if(process.platform!=='linux'||!isAbsolute(cwd)||cwd.includes('/../')||cwd.endsWith('/')||cwd.includes('\0'))throw typedFault();
 signal?.throwIfAborted();let directory,file;
 try{
  const before=await lstat(cwd);if(before.isSymbolicLink()||!before.isDirectory()||before.uid!==process.getuid()||await realpath(cwd)!==cwd)throw typedFault();
  directory=await open(cwd,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);const root=await directory.stat();if(root.dev!==before.dev||root.ino!==before.ino)throw typedFault();
  const raw=assertTypedResultBytes(bytes,descriptor);signal?.throwIfAborted();
  file=await open(`/proc/self/fd/${directory.fd}/${OBJECTIVE_DRAFT_PATH}`,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  const created=await file.stat();if(!created.isFile()||created.nlink!==1||created.uid!==root.uid)throw typedFault();
  await file.writeFile(raw);await file.sync();signal?.throwIfAborted();const after=await file.stat();if(after.size!==raw.length||after.ino!==created.ino||after.dev!==created.dev||after.nlink!==1)throw typedFault();
  // Physical capture subsequently checks the exact journal-pinned digest. A partial/uncertain write is never overwritten/retried.
 }finally{try{await file?.close();}finally{await directory?.close();}}
}
