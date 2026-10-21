/** node packages/runtime/test/generate-hot-path-budget-golden.mjs BASE [DEPENDENCIES_ROOT] */
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extractBaseBudgetValues} from './hot-path-budget-sources.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),base=process.argv[2];
if(!base)throw Error('Supply the final base commit; golden generation never reads the new table.');
const data=await extractBaseBudgetValues({root,base,dependenciesRoot:process.argv[3]??root});
await writeFile(new URL('./hot-path-budgets.golden.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({base:data.baseCommit,hops:Object.keys(data.values).length}));
