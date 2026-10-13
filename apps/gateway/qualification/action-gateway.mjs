/** Fixed action fixture transport using the caller's canonical persisted read authority. */
import {ownFields} from '../sources/source-admission.mjs';
import {createFixtureActionGateway,fixtureActionTransport} from '../local-action/fixture-gateway.mjs';
export function createQualificationActionGateway(configuration){
 const c=ownFields(configuration,['binding','authority','pool','allocationJson','source','limits','now','newId']);
 return Object.freeze({...createFixtureActionGateway(c),mode:'owned-disposable-qualification'});
}

export {fixtureActionTransport as qualificationActionTransport};
