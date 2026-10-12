import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const ids=['search_public_web','scrape_web_page','search_sam_opportunities','get_florida_budget_project'];
for(const id of ids)assert.throws(()=>resolveOperationContract({id,version:'0.2.0'}),/Unknown/);
console.log(JSON.stringify({base:'cff71e1ba8ca8dea8970ad0c778b580a73f84815',unresolved:ids,sourceOnly:true}));
