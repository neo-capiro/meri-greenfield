/** Exact Option B source token set. Profile alone has a new output version. */
export const SIGNED_RETAINED_SOURCE_OPERATIONS=Object.freeze({
 'actions.query':'0.2.0',
 read_monday_client_boards:'0.2.0',get_client_context:'0.3.0',resolve_entity:'0.2.0',
 'mail.list_messages':'0.2.0','mail.search_messages':'0.2.0','mail.read_thread':'0.2.0',
 'meeting.list_upcoming_meetings':'0.2.0','meeting.query_debriefs':'0.2.0','meeting.read_client_meetings':'0.2.0',
 read_client_documents:'0.2.0',find_contacts:'0.2.0',
});
export const signedRetainedSourceOperation=operation=>Boolean(operation&&
 Object.hasOwn(SIGNED_RETAINED_SOURCE_OPERATIONS,operation.id)&&
 SIGNED_RETAINED_SOURCE_OPERATIONS[operation.id]===operation.version);
export const signedRetainedSourceId=id=>typeof id==='string'&&Object.hasOwn(SIGNED_RETAINED_SOURCE_OPERATIONS,id);
