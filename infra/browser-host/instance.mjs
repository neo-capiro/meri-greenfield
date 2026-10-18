// @ts-check
/** Proposed non-root instance/container shape; not a runnable guest bootstrap or a launch request. */
/** @param {ReturnType<import('./binding.mjs').validateHostProposalBinding>} binding */
export function proposeBrowserHostInstance(binding){
 const {allocation:a,source:s,host:h}=binding;
 return Object.freeze({
  allocation:Object.freeze({tenantId:a.tenantId,conversationId:a.conversationId,hostId:a.hostId,
   generation:a.generation,leaseDeadlineMs:a.leaseDeadlineMs,reuseAcrossConversations:false}),
  image:Object.freeze({uri:s.imageUri,configSha256:s.imageConfigSha256,sourceCommit:s.sourceCommit,
   bootstrapSha256:s.bootstrapSha256,seccompSha256:s.seccompSha256}),
  instance:Object.freeze({amiId:h.amiId,amiOwner:h.amiOwner,architecture:h.architecture,instanceType:h.instanceType,
   associatePublicIpAddress:false,metadata:Object.freeze({tokens:'required',hopLimit:1,ipv6:false,instanceTags:false}),
   rootVolume:Object.freeze({sizeGiB:h.rootVolumeGiB,encrypted:true,deleteOnTermination:true})}),
  worker:Object.freeze({uid:1000,gid:1000,privileged:false,addedCapabilities:Object.freeze([]),
   noNewPrivileges:true,readOnlyRoot:true,hostNetwork:false,hostPid:false,
   providerCredentials:false,databaseCredentials:false,sourceAdminCredentials:false,
   modelAccess:'short-lived task-bound trusted proxy capability only'}),
  readiness:Object.freeze({actualHostMeasured:false,nonRootBrowserMeasured:false,rendererSandboxMeasured:false,
   sdkBashSandboxMeasured:false,imageScanAdmitted:false}),
 });
}
