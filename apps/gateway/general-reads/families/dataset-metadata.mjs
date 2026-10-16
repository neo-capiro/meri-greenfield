/** Immutable registry metadata only; no query execution, SQL or transport. */
import {createDatasetMetadataHandler} from '../../sources/dataset-metadata/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='dataset-metadata',sourceDirectory='dataset-metadata';
export function createHandlers(configuration){
 return familyOperations(id).map(operation=>({operation,execute:createDatasetMetadataHandler(configuration)}));
}
