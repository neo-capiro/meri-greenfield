// @ts-check
/** Proposed network topology only. No route, listener, namespace or security group is created here. */
const WEB_PORTS=Object.freeze([80,443]);
const DENIED_TOOL_PATHS=Object.freeze(['direct-public-tcp','direct-private-tcp','direct-dns','udp-quic-webrtc','instance-metadata','container-credentials','trusted-control']);
/** @param {ReturnType<import('./binding.mjs').validateHostProposalBinding>} binding */
export function proposeBrowserHostNetwork(binding){
 const n=binding.network;
 return Object.freeze({
  vpcId:n.vpcId,subnetId:n.subnetId,controlSecurityGroupId:n.controlSecurityGroupId,
  publicAddress:false,publicIngress:false,
  hostSecurityGroup:Object.freeze({initialOutbound:'deny',trustedControl:Object.freeze({port:443,targetSecurityGroupId:n.controlSecurityGroupId}),
   proposedWebEgressPorts:WEB_PORTS,insufficientWithoutNamespaceAndFirewall:true}),
  browserCompartment:Object.freeze({separateUser:true,separateCgroup:true,separateNetworkNamespace:true,
   proxyEndpoint:'http://127.0.0.1:<run-port>',
   path:'tool loopback relay -> allocation-bound veth ingress -> host loopback egress proxy',
   directRoutes:Object.freeze([]),deniedPaths:DENIED_TOOL_PATHS}),
  bashCompartment:Object.freeze({sdkSandboxNetworkNamespace:true,allowAllUnixSockets:false,allowLocalBinding:false,
   path:'SDK proxy bridge -> local relay -> run-bound host Bash proxy',directRoutes:Object.freeze([]),deniedPaths:DENIED_TOOL_PATHS}),
  proxy:Object.freeze({oneRunOnly:true,loopbackOnly:true,resolveAllAddresses:true,denyAnyNonPublicAnswer:true,
   connectOnlyCheckedAddress:true,webPorts:WEB_PORTS,originAllowlist:'effective platform AND tenant AND role; empty means deny all',
   currentness:'trusted lease plus run grant; revoke closes open tunnels'}),
  evidence:Object.freeze({namespaceFirewallVerified:false,directBypassProbesPassed:false,tlsCoalescingEnforced:false,
   publicRouteApproved:false,privateSubnetVerified:false}),
 });
}
