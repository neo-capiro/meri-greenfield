/** Typed Core detail/changes GET bridge; no legacy loop or cursor authenticity claim. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function createResearchPortfolioHandlers(configuration,operations){
 const transport=createRetainedHttpTransport(configuration),now=configuration.now;
 return operations.map(operation=>({operation,async execute(call){try{
  const c=retainedCall(operation,call,now),changes=operation.id==='get_research_portfolio_changes';
  if(!UUID.test(c.input.portfolioId))deny('INVALID_ARGUMENTS');
  const query=new URLSearchParams();if(changes){query.set('limit',String(c.input.limit));if(c.input.cursor!==null)query.set('cursor',c.input.cursor);}
  const path=`/api/research-portfolios/${encodeURIComponent(c.input.portfolioId)}${changes?`/changes?${query}`:''}`;
  const data=await transport.read(c,{path,method:'GET'});
  // The producer DTO already matches the canonical data boundary. Reject unknown
  // fields and oversize/inconsistent pages; never trim a page into apparent completeness.
  const page={binding:c.authority.binding,subject:c.authority.subject,data};
  c.contract.assertOutput(page,{request:c.request,...c.normalizationContext});
  if(c.signal?.aborted)deny('CANCELLED');if(now()>=c.deadlineMs)deny('DEADLINE');
  return JSON.stringify(page);
 }catch(error){throw safeFailure(error);}}}));
}
