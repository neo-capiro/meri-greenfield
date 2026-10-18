/** Production product-port composition (closes the G4 gap: production `startControl` used to receive no product ports).
 * Each family module exports one ordinary synchronous factory `(context) => {ports}` that composes its owners over the trusted
 * control context `{configuration, pool, client, native, now, canonicalProductPorts, artifactRecovery?}` without opening
 * connections, reading secrets or running SQL. A family that is disabled, unconfigured or missing its Core owner contributes
 * no port (or a port that answers its own typed UNAVAILABLE), so control still starts and product readiness names the gap.
 * Families never supply the canonical prepared-candidate ports; a duplicate key is refused here and again by
 * composeRuntimePorts. */
import {types} from 'node:util';
import {fault} from '../config.mjs';
import {createSettingsFamily} from './settings.mjs';
import {createIntentsFamily} from './intents.mjs';
import {createTasksFamily} from './tasks.mjs';
import {createLifecycleFamily} from './lifecycle.mjs';
import {createRoutinesFamily} from './routines.mjs';
import {createMemoryFamily} from './memory.mjs';
import {createDocumentsFamily} from './documents.mjs';
import {createObjectiveFamily} from './objective.mjs';

/** Ordered production family factories. Each entry is `[name, factory]`; the name is used only in refusals. */
export const PRODUCT_FAMILIES=Object.freeze([['settings',createSettingsFamily],['intents',createIntentsFamily],['tasks',createTasksFamily],['lifecycle',createLifecycleFamily],['routines',createRoutinesFamily],['memory',createMemoryFamily],['documents',createDocumentsFamily],['objective',createObjectiveFamily]]);

const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isAsyncFunction(fn)&&!types.isGeneratorFunction(fn);

/** The `productPortsFactory` startControl receives: an ordinary function returning one frozen port record. */
export function createProductPortsFactory({families=PRODUCT_FAMILIES}={}){
 if(!Array.isArray(families)||families.some(entry=>!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!ordinary(entry[1])))throw fault('PRODUCT_PORTS_CONFIGURATION');
 const list=Object.freeze(families.map(([name,factory])=>Object.freeze([name,factory])));
 return function productPortsFactory(context){
  const joined={};
  for(const [,factory] of list){
   const result=Reflect.apply(factory,undefined,[context]);
   if(types.isPromise(result)){Promise.prototype.then.call(result,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
   if(result===null||typeof result!=='object'||types.isProxy(result))throw fault('PRODUCT_PORTS_CONFIGURATION');
   const ports=result.ports??{};
   if(ports===null||typeof ports!=='object'||types.isProxy(ports))throw fault('PRODUCT_PORTS_CONFIGURATION');
   for(const [key,value] of Object.entries(ports)){if(value===undefined)continue;if(Object.hasOwn(joined,key))throw fault('PRODUCT_PORTS_CONFIGURATION');joined[key]=value;}
  }
  return Object.freeze(joined);
 };
}
