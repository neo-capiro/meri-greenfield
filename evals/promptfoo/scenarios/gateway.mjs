/** Government-intelligence scenarios over the canonical gateway authority and dispatch with one synthetic catalog entry. */
import {syntheticPrincipal} from '../../offline-targets/conversation-application.mjs';
import {createScriptedGatewayDispatch,gatewayPrincipal,operation} from '../../offline-targets/gateway-dispatch.mjs';
import {observedAnswer,observedRefusal} from './envelope.mjs';
const SOURCE=`${operation.id}@${operation.version}`;
async function execute(view){const {tenantId,tag,arguments:args}=view.scenario,now=Date.now;
 const g=gatewayPrincipal(syntheticPrincipal({tenantId,actorId:`actor-${tag}`,tag}),{tag,now}),dispatch=createScriptedGatewayDispatch({principals:[g],now});
 return dispatch.execute(JSON.stringify({operation,arguments:args}),g.credential);}
const denial=(view,error)=>{if(error?.name!=='GatewayDenied')throw error;return observedRefusal(view,error.message,{name:error.name,message:error.message});};
export async function gatewayRead(view){try{return observedAnswer(view,{source:SOURCE,observed:JSON.parse(await execute(view))});}catch(error){return denial(view,error);}}
export const gatewayForgedArgument=gatewayRead;
