/** Managed board boundaries come only from the current scoped broker receipt. */
import {deny} from '../../dispatch/operation-result.mjs';
import {ownFields} from './request-context.mjs';
export function managedBoardMapping(value,context) {
  const mapping=ownFields(value,['tenantId','userId','clientId','mappingVersionId','boardIds']);
  if(mapping.tenantId!==context.authority.binding.tenantId||mapping.userId!==context.authority.binding.actorId||
      mapping.clientId!==context.input.clientId||typeof mapping.mappingVersionId!=='string'||!mapping.mappingVersionId.trim()||
      mapping.mappingVersionId.length>256||!Array.isArray(mapping.boardIds)||mapping.boardIds.length>3000||
      mapping.boardIds.some(id=>typeof id!=='string'||!/^[0-9]{1,80}$/.test(id))||new Set(mapping.boardIds).size!==mapping.boardIds.length)deny('ACCESS_DENIED');
  return mapping;
}
export function assertMappedBoards(result,mapping,context) {
  for(const row of result.records) {
    if(row.payload.clientId!==mapping.clientId||row.payload.sourceActorUserId!==mapping.userId||
        !mapping.boardIds.includes(row.payload.origin.boardId))deny('INVALID_RESULT');
  }
  context.active();
}
