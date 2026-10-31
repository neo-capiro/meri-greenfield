/** Synthetic canonical correlated-absence evidence for the EXISTING native-physical-absence validator.
 * Shared by the native receipt-chain fixtures only. It is test data built inside a caller-supplied window; it is
 * NOT a claim about any real host, and no production path may use it. */
const ACCOUNT = /^\d{12}$/u;

export function canonicalEvidence({accountId = '967807252336', region = 'us-east-1',
  instanceId, rootVolumeId, networkInterfaceIds, startedAtMs, nowMs}) {
  if (!ACCOUNT.test(accountId)) throw Error('SYNTHETIC_EVIDENCE_ACCOUNT');
  if (!Number.isSafeInteger(startedAtMs) || !Number.isSafeInteger(nowMs) || nowMs <= startedAtMs) {
    throw Error('SYNTHETIC_EVIDENCE_WINDOW');
  }
  if (!Array.isArray(networkInterfaceIds) || networkInterfaceIds.length < 1) throw Error('SYNTHETIC_EVIDENCE_ENI');
  const meta = requestId => ({requestId, httpStatusCode: 200});
  const at = offset => startedAtMs + offset;
  if (at(4000) > nowMs) throw Error('SYNTHETIC_EVIDENCE_WINDOW_TOO_NARROW');
  return {
    schema: 'meri-native-correlated-absence/1', protocolVersion: 1, accountId, region,
    caller: {accountId, region, arn: `arn:aws:sts::${accountId}:assumed-role/synthetic-e2e/test-session`,
      userId: 'AROASYNTETICE2EUSER:synthetic-e2e'},
    instanceId, rootVolumeId, networkInterfaceIds: [...networkInterfaceIds], operationDeadlineMs: nowMs,
    preObservation: { schema: 'meri-native-preobservation/1', accountId, region, instanceId, rootVolumeId,
      rootVolumeDeleteOnTermination: true, ...meta('synthetic-pre-observation'), atMs: at(1000),
      attachments: networkInterfaceIds.map((id, deviceIndex) => ({ id, deleteOnTermination: true,
        attachmentId: `eni-attach-${String(deviceIndex).padStart(8, '0')}`, deviceIndex })),
      volume: { volumeId: rootVolumeId, state: 'in-use', deleteOnTermination: true, attachmentInstanceId: instanceId,
        ...meta('synthetic-pre-volume') },
      networkInterfaces: networkInterfaceIds.map(id => ({ id, attachmentInstanceId: instanceId,
        deleteOnTermination: true, ...meta('synthetic-pre-interface') })) },
    terminalObservation: { instanceId, state: 'terminated', ...meta('synthetic-terminal'), atMs: at(2000) },
    resources: [
      { kind: 'volume', id: rootVolumeId, observations: [0, 1].map(n => ({ absent: true, resourceId: rootVolumeId,
        errorCode: 'InvalidVolume.NotFound', requestId: `synthetic-absence-volume-${n}`, httpStatusCode: 400,
        atMs: at(3000 + n) })) },
      ...networkInterfaceIds.map((id, interfaceIndex) => ({ kind: 'network-interface', id,
        observations: [0, 1].map(n => ({ absent: true, resourceId: id,
          errorCode: 'InvalidNetworkInterfaceID.NotFound', requestId: `synthetic-absence-eni-${interfaceIndex}-${n}`,
          httpStatusCode: 400, atMs: at(3000 + n) })) })),
    ],
  };
}
