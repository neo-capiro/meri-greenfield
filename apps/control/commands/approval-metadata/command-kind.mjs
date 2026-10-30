/** Closed canonical codec selection. The shared metadata owner keeps policy,
 * immutable storage, replay and release; command families own normalization and
 * command/proposal validation. No dynamic registration or execution belongs here. */
import {mailSendKind} from './mail-send-kind.mjs';
import {taskKind} from './task-kind.mjs';
import {memoryKind} from './memory-kind.mjs';
import {artifactFileKind} from './artifact-file-kind.mjs';
import {documentDraftKind} from './document-draft-kind.mjs';
import {browserActionKind} from './browser-action-kind.mjs';
import {deny} from '../protocol.mjs';

const kinds=Object.freeze({
 'mail.send':mailSendKind,
 'task.create':taskKind('task.create'),
 'task.update':taskKind('task.update'),
 'memory.propose':memoryKind,
 'artifact.file':artifactFileKind('artifact.file'),
 'document.draft':documentDraftKind,
 'browser.action':browserActionKind,
});

export function commandKind(action){
 if(typeof action!=='string'||!Object.hasOwn(kinds,action))deny('COMMAND_PREPARATION_REFUSED');
 return kinds[action];
}
