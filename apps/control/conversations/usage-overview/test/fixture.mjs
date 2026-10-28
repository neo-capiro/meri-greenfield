import {projectUsageOverview,usagePeriods} from '../store.mjs';
export const at=Date.parse('2026-10-27T12:00:00.000Z'),principal={tenantId:'synthetic-tenant',actorId:'synthetic-actor',clientIds:[]};
export const request={schemaVersion:'meri.usage-overview/1'};
export function facts(overrides={}){return {periods:usagePeriods(at),observedAt:new Date(at).toISOString(),rows:[
 {period:'day',state:'completed',recording:'recorded',attempts:'1',charge:'40'},
 {period:'week',state:'completed',recording:'recorded',attempts:'1',charge:'40'},
 {period:'week',state:'failed',recording:'unavailable',attempts:'1',charge:'0'},
 {period:'month',state:'completed',recording:'recorded',attempts:'2',charge:'50'},
 {period:'month',state:'failed',recording:'unavailable',attempts:'1',charge:'0'},
 {period:'month',state:'cancelled',recording:'not-recorded',attempts:'1',charge:'0'},
 ],ledgerRows:[{charge:'80',unavailable:'1'}],currentRows:[{state:'queued',attempts:'2'},{state:'running',attempts:'1'}],
 policyRows:[{revision:'3',monthly_cap_micro_usd:'100',sdk_max_turns:12,sdk_max_budget_micro_usd:'20'}],...overrides};}
export const response=overrides=>projectUsageOverview(facts(overrides));
export function poolFixture(overrides={}){
 const state={calls:[],releases:[],facts:facts(overrides)};
 const client={async query(sql,args){state.calls.push({sql,args});state.beforeQuery?.(sql,args);
  if(sql.startsWith('WITH periods'))return {rows:state.facts.rows};
  if(sql.startsWith('SELECT COALESCE'))return {rows:state.facts.ledgerRows};
  if(sql.startsWith('SELECT projection'))return {rows:state.facts.currentRows};
  if(sql.startsWith('SELECT revision'))return {rows:state.facts.policyRows};return {rows:[]};},release(error){state.releases.push(error);}};
 return {state,pool:{async connect(){return client;}}};
}
