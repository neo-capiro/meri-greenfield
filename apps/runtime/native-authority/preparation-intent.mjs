/** Existing task admission facts. SDK options and child-process launch are owned by the SDK. */
import {isAbsolute,normalize} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {executionFault} from './execution-broker.mjs';
export function compileNativePreparationIntent(value){
 const c=data(own(value,['workspace','configParentDirectory','secureStorageDirectory','imageSha256','runnerSha256','authoritySha256']));
 if(!['workspace','configParentDirectory','secureStorageDirectory'].every(k=>typeof c[k]==='string'&&isAbsolute(c[k])&&normalize(c[k])===c[k]&&c[k]!=='/'&&!c[k].endsWith('/')&&!/[\x00-\x1f\x7f]/u.test(c[k]))||!['imageSha256','runnerSha256','authoritySha256'].every(k=>typeof c[k]==='string'&&/^[a-f0-9]{64}$/u.test(c[k])))throw executionFault('PREPARATION_REFUSED');
 return c;
}
