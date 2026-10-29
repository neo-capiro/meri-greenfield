import {storageMethod} from '../../../../artifacts/storage/boundary.mjs';
/** Native run-owner read carries binding only; control loads the persisted selection. */
export function createTaskSiteWorkflowPort({native}){
 const call=storageMethod(native,'call');
 return Object.freeze({resolve:({binding,signal})=>call('runner/site-workflow-resolve',{binding},{signal})});
}
