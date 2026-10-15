/** Playwright MCP 0.0.83 stdio server configuration: explicit Chromium sandbox, per-conversation profile and output under the conversation workspace, no stored credentials. */
import {join} from 'node:path';
export const BROWSER_SERVER_NAME='meri_browser';
/** Workspace-relative locations owned by one conversation; nothing is created here. */
export const browserPaths=cwd=>Object.freeze({root:join(cwd,'.browser'),profile:join(cwd,'.browser','profile'),output:join(cwd,'.browser','output'),home:join(cwd,'.browser','home')});
export function playwrightServerConfig(policy,paths){
 const {installation:i,timeouts:t}=policy;
 return Object.freeze({type:'stdio',command:i.nodePath,
  args:Object.freeze([i.cliPath,'--headless','--browser','chromium','--sandbox','--user-data-dir',paths.profile,'--output-dir',paths.output,
   '--allowed-origins',policy.allowedOrigins.join(';'),'--block-service-workers','--no-webmcp','--timeout-action',String(t.actionMs),'--timeout-navigation',String(t.navigationMs)]),
  env:Object.freeze({PLAYWRIGHT_BROWSERS_PATH:i.browsersPath,HOME:paths.home}),
  timeout:t.navigationMs+t.actionMs});
}
