/** Explicit Research current observation. Old General receipts are never coerced. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {currentRequest,currentReceipt} from './current-receipt.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HASH=/^[a-f0-9]{64}$/u;
const refuse=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
export function researchCurrentRequest(raw){
 const v=currentRequest(raw);if(v.clientId!==null)refuse();
 return {...v,scopeKind:'research_portfolio'};
}
export function researchCurrentReceipt(raw){
 const v=data(own(raw,['principal','role','permissions','clientIds','identityRevision','membershipRevision','contextRevision','conversationId','selectedClientId','checkedAtMs','expiresAtMs','researchPortfolio']));
 const {researchPortfolio:rawScope,...base}=v,current=currentReceipt(base);
 if(current.selectedClientId!==null)refuse();
 return data({...current,researchPortfolio:researchPortfolioObservation(rawScope)});
}
/** Same strict nine-field observation for trusted internal projections. */
export function researchPortfolioObservation(rawScope){
 rawScope=data(rawScope);
 const scope=own(rawScope,['kind','researchPortfolioId','researchPortfolioName','researchPortfolioRevision','scopeVersion','currentResearchPortfolioName','currentResearchPortfolioRevision','stale','resourceRevision']);
 const names=[scope.researchPortfolioName,scope.currentResearchPortfolioName];
 if(scope.kind!=='research_portfolio'||typeof scope.researchPortfolioId!=='string'||!UUID.test(scope.researchPortfolioId)||
  names.some(name=>typeof name!=='string'||!name.trim()||name.length>400||Array.from(name).length>200)||
  ![scope.researchPortfolioRevision,scope.currentResearchPortfolioRevision].every(n=>Number.isSafeInteger(n)&&n>=0)||
  ![scope.scopeVersion,scope.resourceRevision].every(h=>typeof h==='string'&&HASH.test(h))||
  scope.stale!==(scope.researchPortfolioName!==scope.currentResearchPortfolioName||scope.researchPortfolioRevision!==scope.currentResearchPortfolioRevision))refuse();
 const captured={kind:scope.kind,researchPortfolioId:scope.researchPortfolioId,researchPortfolioName:scope.researchPortfolioName,researchPortfolioRevision:scope.researchPortfolioRevision};
 if(createHash('sha256').update(JSON.stringify(captured)).digest('hex')!==scope.scopeVersion)refuse();
 return data(scope);
}
