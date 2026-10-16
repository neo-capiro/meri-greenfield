// Only dependency imports are replaced; real new driver/dispatcher/activities execute against synthetic ports.
import {mock} from 'node:test';import {createHash} from 'node:crypto';
mock.module(new URL('../../../../packages/contracts/validate.mjs',import.meta.url).href,{namedExports:{canonicalSha256:v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),validateShape:(_name,v)=>v}});
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='@temporalio/client')return{url:new URL('./temporal-client-shim.mjs',import.meta.url).href,shortCircuit:true};if(specifier==='@temporalio/activity')return{url:new URL('./temporal-activity-shim.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
