/** One prebound first run over canonical borrowed owners; no allocation or IO at construction. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeIdentityContext} from './identity-context.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
import {createNativeTaskAuthority} from './task-authority.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export function createNativeFirstRunPorts(configuration){
 const {identity,admission,native,registration,enabled=false,now=Date.now,limits}=own(configuration,['identity','admission','limits'],['native','registration','enabled','now']);
 const i=own(identity,['origin','commandContext','fetchImpl']),l=data(own(limits,['maxRequestMs','maxFactBytes']));
 // The same canonical admitted-run owner supplies the identity join and SDK lease.
 const admitted=Object.freeze({currentRun:storageMethod(admission,'currentRun'),withCurrentAllocation:storageMethod(admission,'withCurrentAllocation')});
 const observed=registration===undefined?undefined:Object.freeze({read:storageMethod(registration,'read')});
 const identityContext=createNativeIdentityContext({...i,currentOwner:admitted,enabled,now,limits:l});
 const authority=native===undefined?undefined:createNativeTaskAuthority({native,enabled,now,maxRequestMs:l.maxRequestMs});
 const sdkSessionOwner=createDurableSdkSessionOwner({admission:admitted,authority,registration:observed,enabled,now,maxRequestMs:l.maxRequestMs});
 return Object.freeze({identityContext,sdkSessionOwner});
}
