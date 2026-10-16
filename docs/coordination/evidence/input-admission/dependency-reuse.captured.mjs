// Read-only resolution of already installed third-party packages. No peer source or package files are changed.
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield/';
const roots=['','apps/control/conversations/','packages/contracts/','packages/ui-stream/','packages/window-resolution/','apps/runtime/','apps/worker/conversation/'];
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||specifier.startsWith('.')||specifier.startsWith('/')||specifier.includes(':')||specifier.startsWith('@capiro/')||specifier.startsWith('@meri/'))throw error;for(const suffix of roots){try{return next(specifier,{...context,parentURL:pathToFileURL(root+suffix+'__input_dependency__.mjs').href});}catch(candidate){if(candidate.code!=='ERR_MODULE_NOT_FOUND')throw candidate;}}throw error;}}});
