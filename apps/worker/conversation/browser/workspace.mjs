/** Per-conversation browser state under the conversation workspace, and its disposal.
 * The Chromium profile (`--user-data-dir`) is persistent for the life of the conversation: cookies, local/session
 * storage, IndexedDB, cache and any site login the user performs during the conversation live there until disposal.
 * Nothing is pre-loaded (no storage state, secrets file, extension or saved session). `disposeBrowserState` removes
 * the profile, HOME and output directories and verifies that none remains; the per-conversation host destruction
 * required by D005 is the backstop. Nothing is created on import or by `browserPaths`. */
import {join,posix} from 'node:path';
import {lstat,realpath,rm} from 'node:fs/promises';
/** Host workspaces are Linux paths: a posix-absolute cwd keeps posix separators on every development host, so the posix
 * checks of the host observers see the same path the workspace owners build; a platform path (Windows test directories)
 * keeps the platform's own joins and normalization. */
const joinUnder=cwd=>(...parts)=>(cwd.startsWith('/')?posix.join:join)(cwd,...parts);
export const browserPaths=cwd=>{const j=joinUnder(cwd);return Object.freeze({root:j('.browser'),profile:j('.browser','profile'),output:j('.browser','output'),home:j('.browser','home')});};
const fail=code=>{throw Object.assign(new Error(code),{code});};
const gone=async path=>{try{await lstat(path);return false;}catch(e){if(e?.code==='ENOENT')return true;throw e;}};
/** Removes all browser state of one conversation. Call after the Playwright MCP process has exited. Refuses when the
 * browser root is a symlink or resolves elsewhere, so disposal never follows a link out of the workspace.
 * Resolves `{disposed:true}` only when profile, home, output and root are verified absent. */
/** @param {{root:string,profile:string,home:string,output:string}} paths @param {{signal?:AbortSignal}} [options] */
export async function disposeBrowserState(paths,{signal}={}){
 if(signal?.aborted)fail('BROWSER_DISPOSE_CANCELLED');
 if(!await gone(paths.root)){
  const stat=await lstat(paths.root);
  if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(paths.root)!==paths.root)fail('BROWSER_DISPOSE_PATH');
  for(const path of [paths.profile,paths.home,paths.output,paths.root])await rm(path,{recursive:true,force:true,maxRetries:2});
 }
 for(const path of [paths.profile,paths.home,paths.output,paths.root])if(!await gone(path))fail('BROWSER_DISPOSE_INCOMPLETE');
 return Object.freeze({disposed:true});
}
