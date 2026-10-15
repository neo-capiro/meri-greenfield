/** Scenario registry keyed by the case vocabulary's scenario kinds. */
import {SCENARIO_KINDS} from '../cases/schema.mjs';
import {conversationHistory,conversationForeignHistory,conversationSubmitReplay} from './conversation.mjs';
import {gatewayRead,gatewayForgedArgument} from './gateway.mjs';
import {artifactTextCreate,artifactTextRevise,artifactForeignDownload} from './artifacts.mjs';
import {sessionStore} from './session-store.mjs';
const RUNNERS=Object.freeze({'conversation-history':conversationHistory,'conversation-foreign-history':conversationForeignHistory,'conversation-submit-replay':conversationSubmitReplay,
 'gateway-read':gatewayRead,'gateway-forged-argument':gatewayForgedArgument,'artifact-text-create':artifactTextCreate,'artifact-text-revise':artifactTextRevise,'artifact-foreign-download':artifactForeignDownload,'session-store':sessionStore});
if(SCENARIO_KINDS.some(k=>!RUNNERS[k])||Object.keys(RUNNERS).length!==SCENARIO_KINDS.length)throw new Error('SCENARIO_REGISTRY');
export const runScenario=view=>RUNNERS[view.scenario.kind](view);
