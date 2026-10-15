/** Closed vocabulary of structural refusal reasons shared by the ZIP, XML/OPC and PDF readers. A reader refuses by
 * throwing `StructureInvalid` with one of these reasons; any other exception is reported as STRUCTURE_UNREADABLE. */
export const STRUCTURE_REASONS=Object.freeze([
 'FORMAT_UNSUPPORTED','STRUCTURE_UNREADABLE','TEXT_ENCODING',
 'ZIP_END_OF_CENTRAL_DIRECTORY','ZIP_CENTRAL_DIRECTORY','ZIP_UNSUPPORTED','ZIP_ENTRY_NAME','ZIP_LOCAL_HEADER','ZIP_DATA_DESCRIPTOR','ZIP_ENTRY_LAYOUT','ZIP_SIZE_LIMIT','ZIP_ENTRY_DATA',
 'XML_MALFORMED','XML_ENCODING','XML_DOCTYPE',
 'OPC_MACRO','OPC_CONTENT_TYPES','OPC_RELATIONSHIPS','OPC_MAIN_PART','OPC_PART_RELATIONSHIPS',
 'PDF_HEADER','PDF_STARTXREF','PDF_XREF','PDF_XREF_STREAM','PDF_OBJECT','PDF_TRAILER','PDF_CATALOG','PDF_PAGE_TREE','PDF_LIMIT']);
export class StructureInvalid extends Error{
 /** @param {string} reason */
 constructor(reason){super(reason);this.reason=STRUCTURE_REASONS.includes(reason)?reason:'STRUCTURE_UNREADABLE';}
}
/** Throws the refusal for `reason`. @param {string} reason @returns {never} */
export function refuse(reason){throw new StructureInvalid(reason);}
