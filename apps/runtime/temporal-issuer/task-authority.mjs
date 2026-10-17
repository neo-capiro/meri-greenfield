import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const ROLES = ['control', 'temporal-worker'];
const IDENTITIES = Object.freeze({
  control: Object.freeze({subject: 'meri-temporal-control:v1', workloadPrincipal: 'meri-workload-control:v1'}),
  'temporal-worker': Object.freeze({subject: 'meri-temporal-worker:v1', workloadPrincipal: 'meri-workload-worker:v1'}),
});
const SHA256 = /^[a-f0-9]{64}$/u;
const NAME = /^[A-Za-z0-9._:/-]{1,160}$/u;
const AWS_ARN = /^arn:aws:(ecs|iam):([a-z0-9-]+)?:([0-9]{12}):(.+)$/u;
const SUBNET = /^subnet-[a-f0-9]{8,17}$/u;
const SECURITY_GROUP = /^sg-[a-f0-9]{8,17}$/u;
const ENI = /^eni-[a-f0-9]{8,17}$/u;

function fault(code = 'TEMPORAL_ISSUER_TASK_AUTHORITY_REFUSED') {
  return Object.assign(new Error(code), { code });
}

function object(value, keys, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key)) ||
      keys.some(key => !Object.hasOwn(value, key))) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  return value;
}

function string(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  return value;
}

function unique(values, pattern, min = 1) {
  if (!Array.isArray(values) || values.length < min || values.some(value => typeof value !== 'string' || !pattern.test(value)) ||
      new Set(values).size !== values.length) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  return Object.freeze([...values]);
}

function arn(value, service, account, region, resource) {
  const match = AWS_ARN.exec(value);
  if (!match || match[1] !== service || match[3] !== account ||
      (service === 'ecs' && match[2] !== region) || (service === 'iam' && match[2] != null) ||
      !resource.test(match[4])) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  return value;
}

function fingerprint(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replaceAll(':', '').toLowerCase();
  return SHA256.test(normalized) ? normalized : null;
}

function taskArnFor(clusterArn, taskArn) {
  const [, region, account, cluster] = /^arn:aws:ecs:([a-z0-9-]+):([0-9]{12}):cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(clusterArn) ?? [];
  return typeof taskArn === 'string' &&
    new RegExp(`^arn:aws:ecs:${region}:${account}:task/${cluster}/[a-f0-9]{32}$`, 'u').test(taskArn);
}

function asDateMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function checkSignal(signal) {
  if (signal?.aborted) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE');
}

// Aborting an AWS request does not prove that its import, SDK send, or borrowed
// binding read has physically settled. Keep the raw promise until settlement and
// return a sticky close receipt for the caller's retirement decision.
function pendingOperations() {
  let closed = false;
  let receipt;
  const pending = new Set();
  const controllers = new Set();
  function assertLive(signal) {
    if (closed || signal?.aborted) throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE');
  }
  function run(action, callerSignal, onPreAborted) {
    if (closed) return Promise.reject(fault('TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'));
    // Proof/authority reads historically return an UNAVAILABLE fact for an
    // already-aborted caller. Their parsers stop before I/O; SDK reader ports
    // continue to reject. There is no raw operation to track in this case.
    if (callerSignal?.aborted) return onPreAborted ? onPreAborted() :
      Promise.reject(fault('TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'));
    const controller = new AbortController();
    const abort = () => controller.abort();
    callerSignal?.addEventListener?.('abort', abort, {once: true});
    controllers.add(controller);
    const operation = Promise.resolve().then(() => {
      assertLive(controller.signal);
      return action(controller.signal);
    });
    pending.add(operation);
    const settle = () => {
      pending.delete(operation);
      controllers.delete(controller);
      callerSignal?.removeEventListener?.('abort', abort);
    };
    operation.then(settle, settle);
    return operation;
  }
  function close() {
    if (receipt) return receipt;
    closed = true;
    for (const controller of controllers) controller.abort();
    receipt = Object.freeze({schemaVersion: 1, state: pending.size === 0 ? 'CLEAN' : 'CLEANUP_UNKNOWN',
      pendingOperations: pending.size});
    return receipt;
  }
  return Object.freeze({run, assertLive, close});
}

/** Closed, static pins. A durable binding source supplies the live task ARN and revocation state. */
export function parseTemporalIssuerTaskAuthorityConfiguration(raw) {
  const c = object(raw, ['schemaVersion', 'clusterArn', 'vpcId', 'privateSubnetIds', 'securityGroupIds', 'maxLeaseMs', 'roles']);
  if (c.schemaVersion !== 1 || !/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(c.clusterArn) ||
      typeof c.vpcId !== 'string' || !/^vpc-[a-f0-9]{8,17}$/u.test(c.vpcId) ||
      !Number.isSafeInteger(c.maxLeaseMs) || c.maxLeaseMs < 1000 || c.maxLeaseMs > 30000) {
    throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  }
  const [, region, account, cluster] = /^arn:aws:ecs:([a-z0-9-]+):([0-9]{12}):cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(c.clusterArn);
  const privateSubnetIds = unique(c.privateSubnetIds, SUBNET);
  const securityGroupIds = unique(c.securityGroupIds, SECURITY_GROUP);
  const roles = object(c.roles, ROLES);
  const parsedRoles = {};
  for (const role of ROLES) {
    const r = object(roles[role], ['subject', 'workloadPrincipal', 'peerSubjectCn', 'peerUriBase', 'serviceArn', 'taskDefinitionArn', 'containerName', 'imageUri', 'taskRoleArn', 'executionRoleArn', 'revision'], ['allowPrimaryInProgress']);
    if (r.subject !== IDENTITIES[role].subject ||
        r.workloadPrincipal !== IDENTITIES[role].workloadPrincipal ||
        (Object.hasOwn(r, 'allowPrimaryInProgress') && typeof r.allowPrimaryInProgress !== 'boolean') ||
        (role === 'control' && r.taskRoleArn === null)) {
      throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
    }
    const serviceArn = arn(r.serviceArn, 'ecs', account, region, new RegExp(`^service/${cluster}/[A-Za-z0-9_-]{1,255}$`, 'u'));
    const taskDefinitionArn = arn(r.taskDefinitionArn, 'ecs', account, region, /^task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u);
    const imagePrefix = `${account}.dkr.ecr.${region}.amazonaws.com/`;
    if (typeof r.imageUri !== 'string' || !r.imageUri.startsWith(imagePrefix) ||
        !/^\S+@sha256:[a-f0-9]{64}$/u.test(r.imageUri) ||
        typeof r.peerUriBase !== 'string' || !r.peerUriBase.startsWith('spiffe://') ||
        !r.peerUriBase.endsWith('/') || !/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_-]+\/$/u.test(r.peerUriBase)) {
      throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
    }
    parsedRoles[role] = Object.freeze({
      subject: string(r.subject, NAME),
      workloadPrincipal: string(r.workloadPrincipal, NAME),
      peerSubjectCn: string(r.peerSubjectCn, /^[A-Za-z0-9._:-]{1,128}$/u),
      peerUriBase: r.peerUriBase,
      serviceArn,
      taskDefinitionArn,
      containerName: string(r.containerName, /^[A-Za-z0-9_-]{1,255}$/u),
      imageUri: r.imageUri,
      taskRoleArn: role === 'temporal-worker' && r.taskRoleArn === null ? null :
        arn(r.taskRoleArn, 'iam', account, region, /^role\/[A-Za-z0-9+=,.@_/-]{1,512}$/u),
      executionRoleArn: arn(r.executionRoleArn, 'iam', account, region, /^role\/[A-Za-z0-9+=,.@_/-]{1,512}$/u),
      revision: string(r.revision, /^[A-Za-z0-9._:-]{1,128}$/u),
      allowPrimaryInProgress: r.allowPrimaryInProgress === true,
    });
  }
  if (parsedRoles.control.subject === parsedRoles['temporal-worker'].subject ||
      parsedRoles.control.workloadPrincipal === parsedRoles['temporal-worker'].workloadPrincipal ||
      parsedRoles.control.peerUriBase === parsedRoles['temporal-worker'].peerUriBase ||
      parsedRoles.control.peerSubjectCn === parsedRoles['temporal-worker'].peerSubjectCn ||
      parsedRoles.control.serviceArn === parsedRoles['temporal-worker'].serviceArn ||
      parsedRoles.control.taskDefinitionArn === parsedRoles['temporal-worker'].taskDefinitionArn ||
      parsedRoles.control.taskRoleArn === parsedRoles['temporal-worker'].taskRoleArn) {
    throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  }
  return Object.freeze({schemaVersion: 1, clusterArn: c.clusterArn, vpcId: c.vpcId,
    privateSubnetIds, securityGroupIds, maxLeaseMs: c.maxLeaseMs, roles: Object.freeze(parsedRoles)});
}

function authenticatedPeer(peer, roleConfig, nowMs) {
  if (!peer || peer.authorized !== true || !peer.certificate ||
      !Buffer.isBuffer(peer.certificate.raw) || peer.certificate.raw.length === 0) return null;
  const certificate = peer.certificate;
  const calculated = createHash('sha256').update(certificate.raw).digest('hex');
  if (fingerprint(certificate.fingerprint256) !== calculated ||
      certificate.subject?.CN !== roleConfig.peerSubjectCn ||
      !(asDateMs(certificate.valid_from) <= nowMs && nowMs < asDateMs(certificate.valid_to))) return null;
  const uriSans = typeof certificate.subjectaltname === 'string'
    ? certificate.subjectaltname.split(/,\s*/u).filter(item => item.startsWith('URI:')).map(item => item.slice(4)) : [];
  if (uriSans.length !== 1 || !uriSans[0].startsWith(roleConfig.peerUriBase)) return null;
  return {certificateSha256: calculated, peerSanUri: uriSans[0]};
}

function currentBinding(value, {certificateSha256, role, roleConfig, clusterArn, nowMs}) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || value.state !== 'CURRENT') return null;
  const keys = ['schemaVersion', 'state', 'certificateSha256', 'role', 'peerSanUri', 'taskArn', 'revision', 'expiresAtMs'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) ||
      value.certificateSha256 !== certificateSha256 || value.role !== role ||
      value.revision !== roleConfig.revision || !taskArnFor(clusterArn, value.taskArn) ||
      value.peerSanUri !== roleConfig.peerUriBase + encodeURIComponent(value.taskArn) ||
      !Number.isSafeInteger(value.expiresAtMs) || value.expiresAtMs <= nowMs) return null;
  return value;
}

function one(array, predicate) {
  return Array.isArray(array) && array.length === 1 && predicate(array[0]) ? array[0] : null;
}

function attachmentDetails(task) {
  const attachment = one(task.attachments?.filter(a => a.type === 'ElasticNetworkInterface'), a => a.status === 'ATTACHED' && Array.isArray(a.details));
  if (!attachment) return null;
  const details = Object.fromEntries(attachment.details.map(item => [item.name, item.value]));
  if (attachment.details.length !== Object.keys(details).length || !ENI.test(details.networkInterfaceId ?? '') ||
      !SUBNET.test(details.subnetId ?? '') || typeof details.privateIPv4Address !== 'string') return null;
  return details;
}

function sameSet(left, right) {
  return Array.isArray(left) && left.length === right.length && new Set(left).size === left.length &&
    left.every(value => right.includes(value));
}

async function serviceOwnsTask(ecs, {clusterArn, serviceName, taskArn, signal}) {
  const arns = new Set();
  const pageTokens = new Set();
  let nextToken;
  // ECS ListTasks is service-scoped; a standalone RunTask may choose an identical group.
  // Refuse a service inventory too large to prove exhaustively in this bounded read.
  for (let page = 0; page < 4; page += 1) {
    const response = await ecs.listTasks({cluster: clusterArn, serviceName,
      desiredStatus: 'RUNNING', maxResults: 100, ...(nextToken === undefined ? {} : {nextToken}), signal});
    checkSignal(signal);
    if (!Array.isArray(response?.taskArns) || response.taskArns.length > 100) return false;
    for (const arn of response.taskArns) {
      if (!taskArnFor(clusterArn, arn) || arns.has(arn)) return false;
      arns.add(arn);
      if (arns.size > 128) return false;
    }
    if (response.nextToken == null) return arns.has(taskArn);
    if (typeof response.nextToken !== 'string' || response.nextToken.length < 1 ||
        response.nextToken.length > 1024 || pageTokens.has(response.nextToken)) return false;
    pageTokens.add(response.nextToken);
    nextToken = response.nextToken;
  }
  return false;
}

/** Fresh, bounded AWS proof shared by post-placement bootstrap and token renewal. */
export function createTemporalIssuerAwsTaskProof({configuration, ecs, ec2, now = Date.now}) {
  const c = parseTemporalIssuerTaskAuthorityConfiguration(configuration);
  if (!ecs || typeof ecs.describeServices !== 'function' || typeof ecs.describeTasks !== 'function' ||
      typeof ecs.listTasks !== 'function' || typeof ecs.describeTaskDefinition !== 'function' ||
      !ec2 || typeof ec2.describeNetworkInterfaces !== 'function' || typeof now !== 'function') {
    throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  }
  const lifetime = pendingOperations();
  const port = Object.freeze({
    async readCurrent({role, taskArn, peerIPv4, signal} = {}) {
      const result = state => {
        let observedAtMs = null;
        try {
          const stamp = now();
          if (Number.isSafeInteger(stamp)) observedAtMs = stamp;
        } catch { /* unavailable clocks cannot produce a current proof */ }
        return Object.freeze({state,
        role: null, taskArn: null, peerIPv4: null, revision: null, serviceArn: null,
        taskDefinitionArn: null, imageUri: null, taskRoleArn: null, executionRoleArn: null,
        observedAtMs, validUntilMs: null});
      };
      try {
        checkSignal(signal);
        const startedAtMs = now();
        if (!Number.isSafeInteger(startedAtMs) || !ROLES.includes(role) ||
            !taskArnFor(c.clusterArn, taskArn) || isIP(peerIPv4) !== 4) return result('REVOKED');
        const pin = c.roles[role];
        const serviceReply = await ecs.describeServices({cluster: c.clusterArn, services: [pin.serviceArn], signal});
        checkSignal(signal);
        const service = one(serviceReply?.services, item => item?.serviceArn === pin.serviceArn &&
          item.clusterArn === c.clusterArn && item.status === 'ACTIVE' && item.taskDefinition === pin.taskDefinitionArn &&
          item.serviceName === pin.serviceArn.split('/').at(-1) &&
          Number.isSafeInteger(item.desiredCount) && item.desiredCount > 0 &&
          Number.isSafeInteger(item.runningCount) && item.runningCount > 0 &&
          one(item.deployments?.filter(d => d.status === 'PRIMARY'),
            d => d.taskDefinition === pin.taskDefinitionArn &&
              (d.rolloutState === 'COMPLETED' ||
                (pin.allowPrimaryInProgress && d.rolloutState === 'IN_PROGRESS'))));
        if (!service || serviceReply.failures?.length) return result('REVOKED');
        const taskReply = await ecs.describeTasks({cluster: c.clusterArn, tasks: [taskArn], signal});
        checkSignal(signal);
        const task = one(taskReply?.tasks, item => item?.taskArn === taskArn &&
          item.clusterArn === c.clusterArn && item.taskDefinitionArn === pin.taskDefinitionArn &&
          item.lastStatus === 'RUNNING' && item.desiredStatus === 'RUNNING' && item.launchType === 'FARGATE' &&
          (item.overrides?.taskRoleArn == null || item.overrides.taskRoleArn === pin.taskRoleArn) &&
          (item.overrides?.executionRoleArn == null || item.overrides.executionRoleArn === pin.executionRoleArn) &&
          item.group === `service:${service.serviceName}` &&
          one(item.containers?.filter(container => container.name === pin.containerName),
            container => container.lastStatus === 'RUNNING' &&
              container.imageDigest === pin.imageUri.slice(pin.imageUri.lastIndexOf('@') + 1)));
        if (!task || taskReply.failures?.length) return result('REVOKED');
        if (!await serviceOwnsTask(ecs, {clusterArn: c.clusterArn, serviceName: service.serviceName,
          taskArn, signal})) return result('REVOKED');
        checkSignal(signal);
        const attachment = attachmentDetails(task);
        // This proof uses the server-observed source of the direct private TLS connection.
        if (!attachment || !c.privateSubnetIds.includes(attachment.subnetId) ||
            peerIPv4 !== attachment.privateIPv4Address) return result('REVOKED');
        const definitionReply = await ecs.describeTaskDefinition({taskDefinition: pin.taskDefinitionArn, signal});
        checkSignal(signal);
        const definition = definitionReply?.taskDefinition;
        if (!definition || definition.taskDefinitionArn !== pin.taskDefinitionArn || definition.status !== 'ACTIVE' ||
            definition.networkMode !== 'awsvpc' || !definition.requiresCompatibilities?.includes('FARGATE') ||
            (definition.taskRoleArn ?? null) !== pin.taskRoleArn ||
            definition.executionRoleArn !== pin.executionRoleArn ||
            !one(definition.containerDefinitions?.filter(container => container.name === pin.containerName),
              container => container.image === pin.imageUri)) return result('REVOKED');
        const eniReply = await ec2.describeNetworkInterfaces({NetworkInterfaceIds: [attachment.networkInterfaceId], signal});
        checkSignal(signal);
        const eni = one(eniReply?.NetworkInterfaces, item => item?.NetworkInterfaceId === attachment.networkInterfaceId &&
          item.VpcId === c.vpcId && item.SubnetId === attachment.subnetId && item.Status === 'in-use' &&
          item.PrivateIpAddress === attachment.privateIPv4Address && item.Association == null &&
          sameSet(item.Groups?.map(group => group.GroupId), c.securityGroupIds));
        if (!eni) return result('REVOKED');
        checkSignal(signal);
        const finishedAtMs = now();
        if (!Number.isSafeInteger(finishedAtMs) || finishedAtMs < startedAtMs ||
            !Number.isSafeInteger(finishedAtMs + c.maxLeaseMs)) return result('REVOKED');
        return Object.freeze({state: 'CURRENT', role, taskArn, peerIPv4, revision: pin.revision,
          serviceArn: pin.serviceArn, taskDefinitionArn: pin.taskDefinitionArn,
          imageUri: pin.imageUri, taskRoleArn: pin.taskRoleArn,
          executionRoleArn: pin.executionRoleArn, observedAtMs: finishedAtMs,
          validUntilMs: finishedAtMs + c.maxLeaseMs});
      } catch {
        return result('UNAVAILABLE');
      }
    },
  });
  return Object.freeze({
    readCurrent(request = {}) {
      return lifetime.run(signal => port.readCurrent({...request, signal}), request.signal,
        () => port.readCurrent(request));
    },
    close: lifetime.close,
  });
}

/**
 * The ECS and EC2 ports are fresh readers. The binding port is an independent, durable
 * certificate/task/revision/revocation authority; absence is never interpreted as current.
 */
export function createTemporalIssuerTaskAuthority({configuration, ecs, ec2, bindings, now = Date.now}) {
  const c = parseTemporalIssuerTaskAuthorityConfiguration(configuration);
  if (!ecs || typeof ecs.describeServices !== 'function' || typeof ecs.describeTasks !== 'function' ||
      typeof ecs.listTasks !== 'function' ||
      typeof ecs.describeTaskDefinition !== 'function' || !ec2 || typeof ec2.describeNetworkInterfaces !== 'function' ||
      !bindings || typeof bindings.readCurrent !== 'function' || typeof now !== 'function') {
    throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  }
  const awsProof = createTemporalIssuerAwsTaskProof({configuration: c, ecs, ec2, now});
  const lifetime = pendingOperations();
  const port = Object.freeze({
    async readCurrent({peer, identity, signal} = {}) {
      const observedAtMs = now();
      const echo = identity && typeof identity === 'object' ?
        {role: identity.role, subject: identity.subject, workloadPrincipal: identity.workloadPrincipal} : null;
      const result = (state, validUntilMs = null, revision) => Object.freeze({state,
        identity: echo, observedAtMs: now(), validUntilMs, ...(revision === undefined ? {} : {revision})});
      try {
        checkSignal(signal);
        if (!Number.isSafeInteger(observedAtMs) || !echo || !ROLES.includes(echo.role)) return result('REVOKED');
        const pin = c.roles[echo.role];
        if (echo.subject !== pin.subject || echo.workloadPrincipal !== pin.workloadPrincipal ||
            Object.keys(identity).length !== 3) return result('REVOKED');
        const certificate = authenticatedPeer(peer, pin, observedAtMs);
        if (!certificate) return result('REVOKED');
        const bindingRequest = Object.freeze({certificateSha256: certificate.certificateSha256, role: echo.role, signal});
        const first = await bindings.readCurrent(bindingRequest);
        checkSignal(signal);
        if (first?.state === 'REVOKED') return result('REVOKED');
        const current = currentBinding(first, {...certificate, role: echo.role, roleConfig: pin, clusterArn: c.clusterArn, nowMs: now()});
        if (!current || certificate.peerSanUri !== current.peerSanUri) return result('REVOKED');
        const taskProof = await awsProof.readCurrent({role: echo.role, taskArn: current.taskArn,
          peerIPv4: peer.remoteAddress, signal});
        // The authority can close after the nested cloud proof resolves but
        // before this continuation runs. Never begin a fresh binding read then.
        checkSignal(signal);
        if (taskProof.state !== 'CURRENT' || taskProof.revision !== current.revision) {
          return result(taskProof.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'REVOKED');
        }
        // A revocation or reassignment during the cloud reads must be visible before release.
        const second = await bindings.readCurrent(bindingRequest);
        checkSignal(signal);
        const refreshed = currentBinding(second, {...certificate, role: echo.role, roleConfig: pin, clusterArn: c.clusterArn, nowMs: now()});
        if (!refreshed || refreshed.taskArn !== current.taskArn || refreshed.peerSanUri !== current.peerSanUri ||
            refreshed.revision !== current.revision) return result('REVOKED');
        const finishMs = now();
        const validUntilMs = Math.min(first.expiresAtMs, second.expiresAtMs,
          taskProof.validUntilMs, finishMs + c.maxLeaseMs);
        if (!Number.isSafeInteger(finishMs) || validUntilMs <= finishMs) return result('REVOKED');
        return Object.freeze({state: 'CURRENT', identity: Object.freeze({...echo}),
          observedAtMs: finishMs, validUntilMs, revision: current.revision});
      } catch {
        return result('UNAVAILABLE');
      }
    },
  });
  return Object.freeze({
    readCurrent(request = {}) {
      return lifetime.run(signal => port.readCurrent({...request, signal}), request.signal,
        () => port.readCurrent(request));
    },
    close() {
      awsProof.close();
      return lifetime.close();
    },
  });
}

/** Real AWS SDK v3 adapters; clients are injected with their own workload credentials. */
export function createTemporalIssuerAwsReaders({ecsClient, ec2Client, loadModule = name => import(name)}) {
  if (typeof ecsClient?.send !== 'function' || typeof ec2Client?.send !== 'function') {
    throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  }
  if (typeof loadModule !== 'function') throw fault('TEMPORAL_ISSUER_TASK_AUTHORITY_CONFIGURATION');
  const lifetime = pendingOperations();
  let ecsCommands;
  let ec2Commands;
  const loadEcs = () => (ecsCommands ??= loadModule('@aws-sdk/client-ecs'));
  const loadEc2 = () => (ec2Commands ??= loadModule('@aws-sdk/client-ec2'));
  function invoke(loader, client, commandName, input, signal) {
    return lifetime.run(async currentSignal => {
      const commands = await loader();
      // A dynamic import may complete after close. Never start a late SDK send.
      lifetime.assertLive(currentSignal);
      return client.send(new commands[commandName](input), {abortSignal: currentSignal});
    }, signal);
  }
  return Object.freeze({
    ecs: Object.freeze({
      describeServices({cluster, services, signal}) {
        return invoke(loadEcs, ecsClient, 'DescribeServicesCommand', {cluster, services}, signal);
      },
      describeTasks({cluster, tasks, signal}) {
        return invoke(loadEcs, ecsClient, 'DescribeTasksCommand', {cluster, tasks}, signal);
      },
      listTasks({cluster, serviceName, desiredStatus, maxResults, nextToken, signal}) {
        return invoke(loadEcs, ecsClient, 'ListTasksCommand', {cluster, serviceName, desiredStatus,
          maxResults, ...(nextToken === undefined ? {} : {nextToken})}, signal);
      },
      describeTaskDefinition({taskDefinition, signal}) {
        return invoke(loadEcs, ecsClient, 'DescribeTaskDefinitionCommand', {taskDefinition}, signal);
      },
    }),
    ec2: Object.freeze({
      describeNetworkInterfaces({NetworkInterfaceIds, signal}) {
        return invoke(loadEc2, ec2Client, 'DescribeNetworkInterfacesCommand', {NetworkInterfaceIds}, signal);
      },
    }),
    close: lifetime.close,
  });
}
