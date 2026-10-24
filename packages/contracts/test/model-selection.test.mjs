import test from 'node:test';import assert from 'node:assert/strict';
import {assertModelSelection,assertModelCatalog,availableModelSelection,storedModelSelection,HISTORICAL_MODEL_SELECTION} from '../model-selection.mjs';
import {MODEL_CATALOG,CLAUDE_SELECTION} from './model-selection-fixture.mjs';
test('catalog uses explicit provider/model/effort availability, including SDK default and xhigh',()=>{
 assert.deepEqual(assertModelCatalog(MODEL_CATALOG),MODEL_CATALOG);
 assert.deepEqual(availableModelSelection(MODEL_CATALOG,CLAUDE_SELECTION),CLAUDE_SELECTION);
 assert.equal(availableModelSelection(MODEL_CATALOG,{...MODEL_CATALOG.defaultSelection,effort:'xhigh'}).effort,'xhigh');
 for(const selection of [{...CLAUDE_SELECTION,effort:'xhigh'},{...CLAUDE_SELECTION,modelId:'synthetic-held'}, {...CLAUDE_SELECTION,modelId:'arbitrary-model'}])assert.throws(()=>availableModelSelection(MODEL_CATALOG,selection),{code:'MODEL_SELECTION_UNAVAILABLE'});
});
test('catalog refuses ambiguous, unavailable default, malformed reason and arbitrary provider data',()=>{
 for(const mutate of [c=>c.models.push(c.models[0]),c=>c.models[0].efforts.push(null),c=>{c.defaultSelection={...CLAUDE_SELECTION,modelId:'synthetic-held',effort:null};},c=>{c.models[0].unavailableReason='model_unqualified';},c=>{c.models[0].secretArn='hidden';}]){const c=structuredClone(MODEL_CATALOG);mutate(c);assert.throws(()=>assertModelCatalog(c));}
 for(const value of [{...CLAUDE_SELECTION,provider:'openai'},{...CLAUDE_SELECTION,effort:undefined},{...CLAUDE_SELECTION,env:{}},{...CLAUDE_SELECTION,modelId:' bad'}])assert.throws(()=>assertModelSelection(value));
 let read=0;const value={...CLAUDE_SELECTION};Object.defineProperty(value,'modelId',{enumerable:true,get(){read++;return 'x';}});assert.throws(()=>assertModelSelection(value));assert.equal(read,0);
});
test('old accepted requests retain the exact historical selection; explicit malformed new selections never fall back',()=>{
 assert.deepEqual(storedModelSelection({requestId:'old'}),HISTORICAL_MODEL_SELECTION);
 assert.deepEqual(storedModelSelection({modelSelection:CLAUDE_SELECTION}),CLAUDE_SELECTION);
 for(const modelSelection of [null,undefined,{}])assert.throws(()=>storedModelSelection({modelSelection}));
});
