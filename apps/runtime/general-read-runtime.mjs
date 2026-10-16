/** Trusted CONTROL-side composition. Never import this factory in an isolated runner.
 * Pool, current authority, producer context, broker-backed handlers and native receipts
 * are borrowed from their existing owners; nothing here grants or qualifies access. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createGeneralReadInstallationOwner} from '../gateway/general-reads/installation.mjs';
import {createGeneralReadGatewayMount} from '../gateway/general-reads/mount.mjs';
import {deny} from '../gateway/dispatch/operation-result.mjs';
const REQUIRED=['pool','allocationJson','authority','limits','producerContext','producer','credential','handlers',
 'readCurrentInstallation','discoveryOwner','catalogJson','contracts','scopes','now','newId'];
const OPTIONAL=['sourceEnabled','sourceRoot','memoryContextPorts','mailContextPorts','retainedContextPorts','defaultCongress','namespace'];
const unavailable=Object.freeze({async readAvailability(){deny('UNAVAILABLE');},async execute(){deny('UNAVAILABLE');}});
export function createControlGeneralReadRuntime(configuration={}){
 const c=own(configuration,[],[...REQUIRED,...OPTIONAL]);
 if(c.sourceEnabled!==undefined&&typeof c.sourceEnabled!=='boolean')deny('GATEWAY_CONFIGURATION');
 if(c.sourceEnabled!==true||REQUIRED.some(k=>c[k]===undefined))return unavailable;
 const {handlers,readCurrentInstallation,scopes,sourceRoot,...gateway}=c;
 const installationOwner=createGeneralReadInstallationOwner({binding:data(gateway.producerContext).binding,scopes,handlers,
  readCurrentInstallation,catalogJson:gateway.catalogJson,now:gateway.now,...(sourceRoot===undefined?{}:{sourceRoot})});
 // Only these two methods leave control. No pool, credential, registry or native
 // owner is exposed; task transport and its capability binding remain required.
 return createGeneralReadGatewayMount({...gateway,installationOwner});
}
