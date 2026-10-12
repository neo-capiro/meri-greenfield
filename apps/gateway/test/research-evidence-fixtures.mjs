/** Synthetic domain records; no private source rows or production credentials. */
import { fixture, NOW, uuid, limits } from './fixtures.mjs';
import { resolveOperationContract } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { createResearchPortfolioEvidenceHttpAdapter } from '../sources/research-portfolio-evidence/http-adapter.mjs';
import { createResearchPortfolioEvidenceHandler } from '../sources/research-portfolio-evidence/handler.mjs';

export const operation = {id:'get_research_evidence',version:'0.2.0'};
export const portfolioId = uuid('a'), recordId = uuid('b'), instant = new Date(NOW).toISOString();
export const request = raw => JSON.stringify({operation,arguments:raw});
export function review() {
  return {id:recordId,tenantId:'synthetic-tenant',portfolioId,targetKind:'program',targetId:'program-one',
    revision:4,updatedAt:instant,evidenceFor:[{sourceRevisionId:'source:revision/7',
      locator:{page:3,range:[1,2],unverified:'source statement'},quote:'Synthetic quote',stance:'for'}],
    evidenceAgainst:[{sourceRevisionId:'source-revision-two',locator:{page:7},quote:null,stance:'against'}]};
}
export function snapshot() {
  return {id:recordId,portfolioId,portfolioRevision:3,contentHash:'a'.repeat(64),calculationVersion:'research-portfolio-analytics-v1',
    capturedAt:instant,observedAt:instant,readAt:instant,
    projection:{portfolioId,portfolioRevision:3,calculationVersion:'research-portfolio-analytics-v1',contributions:[{
      contributionId:'contribution-one',memberId:'member-one',targetKind:'program',targetId:'program-one',label:null,
      basis:{requestEdition:null,fundingFiscalYear:2026,stage:'request',metric:'funding',unit:'usd_millions',currency:'USD',priceBasis:null,knownAt:null},
      value:'9007199254740993.125',disposition:'included',reason:'Synthetic source claim',sourceObservationId:null,
      sourceRevisionIds:['opaque-revision:1'],evidence:[{source:'synthetic',page:1}],dedupKey:null,overlapsContributionId:null}]},
    versions:{structure:{id:'structure',revision:3},rules:[{id:'rule',sourceRevision:'r1'}],decisions:[],templates:[],taxonomy:[],labels:[],sources:[{revision:'opaque-revision:1'}]},
    limitations:['Retained source limitation'],clientAccessRequirements:['synthetic-client-access-requirement']};
}
export function continuity() {
  return {items:[{persisted:false,id:'readonly:continuity-one',tenantId:'synthetic-tenant',portfolioId,
    priorDecisionId:'decision-before',currentDecisionId:'decision-current',continuityKey:'key:current',
    priorDependencyFingerprint:null,dependencyFingerprint:'fingerprint-current',status:'changed',identityMapping:{renamed:false},
    changedDependencies:{versions:['one','two']},originalEvidence:{for:[{revision:'source:7',quote:'Synthetic current derived evidence'}]},
    sourceEdition:'2026',relevantPeriodStart:'2026-01-01',relevantPeriodEnd:null,expiryDate:null,
    reopeningReason:null,reopeningReviewId:null,createdAt:instant,updatedAt:instant}],
    counts:{unchanged:0,changed:1,expired:0,renamed:0,renumbered:0,split:0,merged:0,unresolved:0,new:0},
    knownAtSupport:'current_projection_with_temporal_identity',limitations:['Synthetic source retention limit']};
}
export function setup(origin='review') {
  const f = fixture(), wire = [], pages = origin === 'review' ? [[],[review()],[],[]] : [origin === 'snapshot' ? snapshot() : continuity()];
  Object.assign(f.subject,{kind:'entity',entityType:'research-portfolio',entityIds:[portfolioId]});
  f.state.grants = ['tool.read']; f.entry.contract = resolveOperationContract(operation); f.entry.descriptor = f.entry.contract.descriptor;
  const business = f.ports.authorizeBusiness;
  f.ports.authorizeBusiness = async (...args) => {
    const row = JSON.parse(await business(...args)); row.decision.operation = `${operation.id}@${operation.version}`;
    return JSON.stringify(row);
  };
  f.ports.authorizeSources = async () => JSON.stringify({sourceIds:['research_portfolios'],enabled:f.state.sourceEnabled,
    policyRevision:f.claims.policyRevision,checkedAtMs:f.state.now});
  const credentials = () => ({binding:structuredClone(f.binding),bearerToken:'SYNTHETIC_USER_TOKEN',expiresAtMs:NOW+10000});
  const config = {origin:'https://source.example.invalid',now:()=>f.state.now,maxRequestMs:1000,maxResponseBytes:65536,
    getCredentials:async () => { f.calls.push('credentials'); return credentials(); },
    fetchImpl:async (url,options) => { f.calls.push('http'); wire.push({url,options}); return new Response(JSON.stringify(pages[wire.length-1]),{headers:{'content-type':'application/json'}}); }};
  const create = (changes={}) => {
    const adapter = createResearchPortfolioEvidenceHttpAdapter({...config,...changes});
    f.entry.execute = createResearchPortfolioEvidenceHandler({adapter,now:()=>f.state.now});
    return createToolDispatch({catalog:{entry:()=>f.entry,discoverable:()=>[]},authority:f.authority,budget:f.budget,
      limits,now:()=>f.state.now,newId:()=>uuid('7'),sourceEnabled:true});
  };
  const raw = {origin,...(origin === 'current_continuity' ? {} : {recordId})};
  return {...f,wire,pages,credentials,config,create,raw};
}
