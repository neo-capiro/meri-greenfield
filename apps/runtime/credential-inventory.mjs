/** The runtime image's protected-path inventory every fixed no-model child must prove it cannot read.
 *
 * It is ONE list for every purpose that composes a fixed child in this image (the renderer and upload inspection on
 * the AgentCore runtime, and the CONTROL host's local upload composition): a child that cannot reach the task-local
 * material root, the launch-broker socket directory, the Temporal material, the AWS credential file, the SDK workspace
 * or the platform secrets mount has no credential path left to read, so `noCredentials` is attestable on exactly this
 * inventory and never on an empty one. Neither sandbox owns it: both import it from here. */
export const RUNTIME_CREDENTIAL_PATHS=Object.freeze(['/run/meri','/run/meri-launch','/run/meri-temporal','/home/node/.aws/credentials','/workspace','/var/run/secrets']);
