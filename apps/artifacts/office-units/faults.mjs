/** Closed refusals of the bounded Office unit editor. The unit id rides the error for the model and the UI;
 * nothing else about the document does. */
export const OFFICE_EDIT_UNIT_CODES=Object.freeze(['OFFICE_EDIT_UNIT_UNKNOWN','OFFICE_EDIT_UNIT_CHANGED','OFFICE_EDIT_UNIT_UNSUPPORTED']);
export function unitFault(code,unit){throw Object.assign(Error(`${code}: ${unit}`),{code,unit});}
