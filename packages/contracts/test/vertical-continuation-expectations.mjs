// Exact inverse only for declared vertical deltas; current catalog is never read.
import assert from 'node:assert/strict';
import {verticalOperationIds,portfolioBoundaryBefore,portfolioBoundaryAfter} from './vertical-source-expectations.mjs';
export function priorVerticalBoundary(id,boundary){
 if(id!=='get_research_evidence')return boundary;
 assert.equal(boundary,portfolioBoundaryAfter);
 return portfolioBoundaryBefore;
}
export function priorVerticalOriginal(row){
 const result={...row,boundary:priorVerticalBoundary(row.id,row.boundary)};
 if(!verticalOperationIds.includes(row.id))return result;
 assert.equal(row.state,'mapped');assert.deepEqual(row.replacement,{id:row.id,version:'0.2.0'});
 return {...result,state:'pending',replacement:null};
}
