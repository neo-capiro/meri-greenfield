/** The global dataset list is the pinned local projection, with no source credential or endpoint. */
import {publicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';

/** Supply this family only inside the composer's already validated per-task port callback. */
export function datasetMetadataTaskPort(){
 return Object.freeze({registry:publicDomainDatasetRegistry});
}
