/** Captured subject correlation only. Core's current receipt grants access. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertResearchPortfolioCapture} from '../../../../packages/contracts/research-portfolio-scope.mjs';
import {researchCurrentReceipt} from './research-current-receipt.mjs';
const refuse=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
export function researchContextFields(raw){
 if(!raw||typeof raw!=='object'||types.isProxy(raw))refuse();
 const kind=Object.getOwnPropertyDescriptor(raw,'scopeKind'),scope=Object.getOwnPropertyDescriptor(raw,'scope');
 if(!kind&&!scope)return {};
 if(!kind||!scope||!kind.enumerable||!scope.enumerable||!Object.hasOwn(kind,'value')||!Object.hasOwn(scope,'value')||kind.value!=='research_portfolio')refuse();
 return data({scopeKind:'research_portfolio',scope:assertResearchPortfolioCapture(scope.value)});
}
export function sameResearchContext(left,right){return hash(researchContextFields(left))===hash(researchContextFields(right));}
export function researchContextFromCurrent(raw){
 const {researchPortfolio:s}=researchCurrentReceipt(raw);
 return researchContextFields({scopeKind:'research_portfolio',scope:{kind:s.kind,researchPortfolioId:s.researchPortfolioId,
  researchPortfolioName:s.researchPortfolioName,researchPortfolioRevision:s.researchPortfolioRevision,scopeVersion:s.scopeVersion}});
}
/** An explicit selector is not a grant. A null client never supplies this kind. */
export function researchHints(raw){
 const h=data(own(raw,[],['conversationId','runId','clientId','scopeKind','scope'])),subject=researchContextFields(h);
 if(subject.scopeKind&&h.clientId!==null)refuse();return h;
}
