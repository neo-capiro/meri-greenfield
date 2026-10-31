/** Inert input for the packaged image probe, not serving configuration.
 * Keep this module self-contained: test directories are intentionally absent from the image.
 * The source regression test compares it with the canonical AgentCore test fixture, and
 * the probe validates each derived role through the real configuration/material validators. */
export function imageProbeControlFixture() {
  return {configuration: {
    version: 1, profile: 'isolated-preview', sourceEnabled: false,
    limits: {startupMs: 3000, shutdownMs: 1000, requestMs: 1000, requestBytes: 131072},
    native: {origin: 'https://control.synthetic.invalid', capabilityFile: '/run/secrets/control', loopback: false, maxResponseBytes: 2097152},
    http: {hostname: '0.0.0.0', port: 8080, frontendOrigin: 'https://frontend.synthetic.invalid'},
    privateHttp: {hostname: '0.0.0.0', port: 8082, frontendOrigin: 'https://control.synthetic.invalid'},
    database: {connectionFile: '/run/secrets/database'},
    temporal: {address: 'temporal.synthetic.invalid:7233', namespace: 'meri-first', taskQueue: 'meri-v1',
      tls: {caFile: '/run/secrets/ca', certFile: '/run/secrets/cert', keyFile: '/run/secrets/key'}},
    sessions: {mode: 'process-local', replicas: 1, maxSessions: 10, maxTtlMs: 300000},
    versions: {imageDigest: `sha256:${'a'.repeat(64)}`, sdk: '0.3.295', cli: '2.1.295', contracts: '0.1.0',
      skillsDigest: 'b'.repeat(64), checkpointFormat: '0.1.0'},
    agentcore: {runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_preview-synthetic',
      runtimeVersion: '2', qualifier: 'preview', identity: {origin: 'https://core.synthetic.invalid'},
      policyRevision: 'policy-v1', runWindowMs: 900000, maxOutputBytes: 262144},
    models: {defaultSelection: {provider: 'bedrock', modelId: 'us.anthropic.claude-sonnet-4-6', effort: null}, models: [
      {provider: 'bedrock', modelId: 'us.anthropic.claude-sonnet-4-6', label: 'Synthetic Bedrock', efforts: [null, 'low', 'high', 'xhigh'], available: true, unavailableReason: null},
      {provider: 'claude-api', modelId: 'claude-sonnet-4-6', label: 'Synthetic Claude API', efforts: [null, 'low', 'high', 'max'], available: true, unavailableReason: null},
      {provider: 'claude-api', modelId: 'synthetic-held', label: 'Synthetic unavailable', efforts: [null], available: false, unavailableReason: 'model_unqualified'},
    ]},
  }};
}
