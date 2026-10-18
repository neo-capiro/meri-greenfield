/** Inert Linux mount: the image seeds only /workspace; no conversation child. */
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
export const runtimeIdentity=Object.freeze({platform:'linux',uid:1000,gid:1000});
export function workspaceFixture(){
 const original=createExecutionBinding({binding,versions,plan:{test:'workspace-startup'},expiresAtMs:Date.now()+60000}),configuration={binding,versions,workspace:'/workspace/'+binding.conversationId};
 let inode=1;const directories=new Map(),events=[],aliases=new Map();
 const stat=(overrides={})=>({dev:1,ino:inode++,uid:1000,gid:1000,mode:0o40700,isDirectory:()=>true,isSymbolicLink:()=>false,...overrides});
 directories.set('/workspace',stat());const error=code=>Object.assign(Error(code),{code});
 const fs={
  async lstat(path){events.push(['lstat',path]);if(!directories.has(path))throw error('ENOENT');return directories.get(path);},
  async realpath(path){if(!directories.has(path))throw error('ENOENT');return aliases.get(path)??path;},
  async open(path,flags){events.push(['open',path,flags]);const held=await fs.lstat(path);if(!held.isDirectory()||held.isSymbolicLink())throw error('ELOOP');return {async stat(){return held;},async close(){events.push(['close',path]);}};},
  async mkdir(path,options){events.push(['mkdir',path,options]);if(directories.has(path))throw error('EEXIST');directories.set(path,stat({mode:0o40000|options.mode}));},
  async rmdir(path){events.push(['rmdir',path]);if([...directories.keys()].some(p=>p.startsWith(path+'/')))throw error('ENOTEMPTY');if(!directories.delete(path))throw error('ENOENT');},
 };
 return {configuration,original,directories,aliases,events,fs,stat,dependencies:{fs,runtimeIdentity}};
}
