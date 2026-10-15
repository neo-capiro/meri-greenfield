/** Real, canonical temporary directories for capability tests: a materialized original skill plugin (the trusted
 * prepared copy), prepared conversation workspaces and a scratch root for alias/symlink cases. Removed when the test
 * process exits. */
import {mkdirSync,mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {materializeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
export const scratch=realpathSync(mkdtempSync(join(tmpdir(),'meri-capability-')));
process.once('exit',()=>rmSync(scratch,{recursive:true,force:true}));
export const plugin=join(scratch,'skill-plugin');
await materializeSkillPlugin({directory:plugin});
/** The prepared (existing, canonical) workspace of one conversation, as runtime preparation provides it.
 * @param {string} conversationId */
export const preparedWorkspace=conversationId=>{const directory=join(scratch,'workspaces',conversationId);mkdirSync(directory,{recursive:true});return directory;};
