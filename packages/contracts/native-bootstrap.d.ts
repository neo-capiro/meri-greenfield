/** PURE native bootstrap wire contract. Shape/byte/join validation grants no authority or transport trust. */
export declare function nativeBootstrapCleanupCeiling(scope:{allocation:{leaseDeadlineMs:number};cleanupCeilingMs?:number}):number;
export declare const NATIVE_BOOTSTRAP_OPERATION_SCHEMA:'meri-native-bootstrap-operation/1';
export declare const NATIVE_BOOTSTRAP_SPEC_SCHEMA:'meri-native-bootstrap-spec/1';
export declare const NATIVE_BOOTSTRAP_PREPARE_REQUEST:'meri-native-bootstrap-prepare-request/1';
export declare const NATIVE_BOOTSTRAP_INSTALL_REQUEST:'meri-native-bootstrap-install-request/1';
export declare const NATIVE_BOOTSTRAP_PREPARE:'meri-native-bootstrap-prepare/1';
export declare const NATIVE_BOOTSTRAP_INSTALL:'meri-native-bootstrap-install/1';
export declare const NATIVE_BOOTSTRAP_INSTALLED:'meri-native-bootstrap-installed/1';
export declare const NATIVE_BOOTSTRAP_PAYLOAD_MAX_BYTES:16384;
export declare const NATIVE_BOOTSTRAP_PAYLOAD_MAX_CHARS:21846;
export declare const NATIVE_BOOTSTRAP_STDOUT_MAX_BYTES:20000;
export declare const NATIVE_BOOTSTRAP_CLAIM_MIN_MS:30000;
export declare const NATIVE_BOOTSTRAP_STEPS:readonly ['prepare','install'];
export interface NativeBootstrapDocument {readonly name:string;readonly version:string;readonly sha256:string;readonly pluginName:'nativeBootstrap'}
export interface NativeBootstrapEndpoint {readonly address:string;readonly port:number;readonly serverName:string}
export interface NativeBootstrapControl {readonly endpoint:NativeBootstrapEndpoint;readonly clientName:string;readonly serverCertificate:string;readonly clientCertificate:string;readonly caCertificate:string;readonly policySha256:string}
export interface NativeBootstrapSpec {readonly schema:'meri-native-bootstrap-spec/1';readonly document:NativeBootstrapDocument;readonly programSha256:string;readonly profileSha256:string;readonly hostEndpoint:Readonly<{port:number;serverName:string}>;readonly control:NativeBootstrapControl;readonly issuerCaCertificate:string}
export interface NativeBootstrapSource {readonly imageDigest:string;readonly sourceCommit:string;readonly bootstrapSha256:string;readonly nativeHelperSha256?:string}
export interface NativeAllocation {readonly schema:'meri-conversation-host-allocation/1';readonly tenantId:string;readonly conversationId:string;readonly generation:number;readonly hostId:string;readonly hostMode:'native-processing';readonly imageDigest:string;readonly leaseDeadlineMs:number}
export interface NativeRunBinding {readonly tenantId:string;readonly actorId:string;readonly conversationId:string;readonly runId:string;readonly attemptId:string;readonly workerId:string;readonly writerFence:number}
export interface NativeBootstrapScope {readonly allocation:NativeAllocation;readonly originalBinding:NativeRunBinding;readonly ownerInstanceId:string;readonly instanceId:string;readonly endpoint:NativeBootstrapEndpoint;readonly source:NativeBootstrapSource;readonly declarationSha256:string;readonly bootstrapSpecSha256:string;readonly cleanupCeilingMs?:number}
export interface NativeBootstrapPreparePayload {readonly schema:'meri-native-bootstrap-prepare-request/1';readonly operationId:string;readonly scope:NativeBootstrapScope;readonly bootstrapSpec:NativeBootstrapSpec}
export interface NativeBootstrapInstallPayload {readonly schema:'meri-native-bootstrap-install-request/1';readonly operationId:string;readonly scope:NativeBootstrapScope;readonly bootstrapSpec:NativeBootstrapSpec;readonly prepareOperationId:string;readonly prepareRequestSha256:string;readonly prepareObservationSha256:string;readonly bootId:string;readonly hostCertificate:string;readonly serverCertificate:string}
export type NativeBootstrapPayload=NativeBootstrapPreparePayload|NativeBootstrapInstallPayload;
export interface NativeBootstrapPrepareObservation {readonly schema:'meri-native-bootstrap-prepare/1';readonly operationId:string;readonly requestSha256:string;readonly scope:NativeBootstrapScope;readonly bootId:string;readonly preparedAtMs:number;readonly hostCsrPem:string;readonly serverCsrPem:string;readonly hostSpkiSha256:string;readonly serverSpkiSha256:string;readonly hostProofBase64:string;readonly serverProofBase64:string}
export interface NativeBootstrapInstallObservation {readonly schema:'meri-native-bootstrap-install/1';readonly operationId:string;readonly requestSha256:string;readonly scope:NativeBootstrapScope;readonly prepareOperationId:string;readonly prepareRequestSha256:string;readonly prepareObservationSha256:string;readonly bootId:string;readonly installedAtMs:number;readonly hostSpkiSha256:string;readonly serverSpkiSha256:string;readonly hostCertificateSha256:string;readonly serverCertificateSha256:string;readonly configSha256:string}
export interface NativeBootstrapSdkRequest {readonly DocumentName:string;readonly DocumentVersion:string;readonly DocumentHash:string;readonly DocumentHashType:'Sha256';readonly InstanceIds:readonly [string];readonly Parameters:Readonly<{Payload:readonly [string]}>;readonly TimeoutSeconds:30;readonly Comment:string;readonly MaxConcurrency:'1';readonly MaxErrors:'0'}
export interface NativeBootstrapRequestContext {readonly step:'prepare'|'install';readonly payload:NativeBootstrapPayload;readonly scope:NativeBootstrapScope;readonly bootstrapSpec:NativeBootstrapSpec;readonly bootstrapSpecSha256:string;readonly request:NativeBootstrapSdkRequest}
export declare function nativeBootstrapOperationId(input:Readonly<{hostId:string;generation:number;step:'prepare'|'install'}>):string;
export declare function assertNativeBootstrapSpec(raw:unknown):NativeBootstrapSpec;
export declare function encodeNativeBootstrapPayload(payload:NativeBootstrapPayload):string;
export declare function decodeNativeBootstrapPayload(value:unknown):NativeBootstrapPayload;
export declare function createNativeBootstrapRequest(payload:NativeBootstrapPayload):NativeBootstrapSdkRequest;
export declare function assertNativeBootstrapRequest(request:unknown,options:{reservation:unknown;step:'prepare'|'install'}):NativeBootstrapRequestContext;
export declare function assertNativeBootstrapObservation(observation:unknown,options:{request:NativeBootstrapSdkRequest|NativeBootstrapRequestContext;prepareObservation?:NativeBootstrapPrepareObservation}):NativeBootstrapPrepareObservation|NativeBootstrapInstallObservation;
export declare function decodeNativeBootstrapObservation(stdout:unknown,context:{request:NativeBootstrapSdkRequest|NativeBootstrapRequestContext;prepareObservation?:NativeBootstrapPrepareObservation}):NativeBootstrapPrepareObservation|NativeBootstrapInstallObservation;
export declare function nativeBootstrapKeyProofMessage(statement:Omit<NativeBootstrapPrepareObservation,'hostProofBase64'|'serverProofBase64'>,role:'host-client'|'host-server'):Buffer;
