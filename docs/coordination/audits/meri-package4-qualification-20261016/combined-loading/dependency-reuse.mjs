import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFileSync,readFileSync} from 'node:fs';
const roots=[
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/packages/contracts/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/packages/window-resolution/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/packages/ui-stream/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/apps/runtime/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/apps/worker/conversation/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/apps/artifacts/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/apps/artifacts/storage/',
 'C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/'
];
const resolutions=new Map();
registerHooks({resolve(specifier,context,nextResolve){
 const aliases=[['@capiro/meri-contracts','contracts'],['@capiro/meri-ui-stream','ui-stream'],['@capiro/meri-window-resolution','window-resolution']];
 for(const [name,directory] of aliases){if(specifier===name||specifier.startsWith(name+'/')){
  const folder=new URL('../packages/'+directory+'/',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',folder),'utf8'));
  const exported=typeof pkg.exports==='string'?pkg.exports:pkg.exports[specifier===name?'.':'.'+specifier.slice(name.length)];
  const target=typeof exported==='string'?exported:exported?.import??exported?.default;
  if(!target)throw Object.assign(Error('Unexported canonical product alias '+specifier),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  const result=nextResolve(new URL(target,folder).href,context);resolutions.set(specifier,result.url);return result;
 }}
 try{return nextResolve(specifier,context);}catch(error){
  if(error.code!=='ERR_MODULE_NOT_FOUND'||specifier.startsWith('.')||specifier.includes(':')||specifier.startsWith('/'))throw error;
  // Product source always comes from this integrated checkout. Borrow only installed third-party packages.
  if(specifier.startsWith('@capiro/')||specifier.startsWith('@meri/'))throw error;
  for(const root of roots){try{const result=nextResolve(specifier,{...context,parentURL:pathToFileURL(root+'__qualification_dependency__.mjs').href});resolutions.set(specifier,result.url);return result;}catch(candidate){if(candidate.code!=='ERR_MODULE_NOT_FOUND')throw candidate;}}
  throw error;
 }
}});
process.on('exit',()=>writeFileSync(new URL('./dependency-resolutions.json',import.meta.url),JSON.stringify({classification:'Read-only third-party dependency reuse; actual integrated product sources, not installed-image qualification',resolutions:[...resolutions]},null,2)+'\n'));
