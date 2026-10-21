/** Closed canonical codec selection. The shared metadata owner keeps policy,
 * immutable storage, replay and release; command families own normalization and
 * command/proposal validation. No dynamic registration or execution belongs here. */
import {taskKind} from './task-kind.mjs';
import {memoryKind} from './memory-kind.mjs';
import {artifactFileKind} from './artifact-file-kind.mjs';
import {deny} from '../protocol.mjs';

const kinds=Object.freeze({
 'task.create':taskKind('task.create'),
 'task.update':taskKind('task.update'),
 'memory.propose':memoryKind,
 'artifact.file':artifactFileKind('artifact.file'),
});

export function commandKind(action){
 if(typeof action!=='string'||!Object.hasOwn(kinds,action))deny('COMMAND_PREPARATION_REFUSED');
 return kinds[action];
}
