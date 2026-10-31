/** Immutable captured identity, never current portfolio permission or freshness. */
import Ajv from 'ajv/dist/2020.js';
import {data,own} from './commands-0.2/execution-boundary.mjs';
const fields=['kind','researchPortfolioId','researchPortfolioName','researchPortfolioRevision','scopeVersion'];
export function researchPortfolioCaptureSchema(){return {
 title:'ResearchPortfolioCapture',type:'object',additionalProperties:false,required:[...fields],properties:{
  kind:{const:'research_portfolio'},
  researchPortfolioId:{type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},
  researchPortfolioName:{type:'string',minLength:1,maxLength:200,pattern:'\\S'},
  researchPortfolioRevision:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},
  scopeVersion:{type:'string',pattern:'^[0-9a-f]{64}$'},
 }};}
const validate=new Ajv({strict:true}).compile(researchPortfolioCaptureSchema());
/** Node callers receive inert data; Core/native current observation owns the capture hash check. */
export function assertResearchPortfolioCapture(raw){
 const value=data(own(raw,fields));
 if(!validate(value)||value.researchPortfolioName.length>400||!value.researchPortfolioName.isWellFormed())
  throw Object.assign(Error('RESEARCH_CAPTURE_INVALID'),{code:'RESEARCH_CAPTURE_INVALID'});
 return value;
}
