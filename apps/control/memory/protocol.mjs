/** Memory transport paths and ceilings (routes.mjs owns the handlers and policy). Shared by the control route boundary and the
 * runtime product dispatcher so the public allowlist and the mount cannot drift apart. Import-light on purpose: composer files load
 * this without the producer, journal or Core client graph.
 *
 *  proposals/*  the governed producer surface (memory-surface 0.1-proposal; `wire.mjs`): own proposals, status, propose, correct.
 *  review/*     the Meri review path of D016 #6: the proposer's own PENDING candidates (personal candidates never reach Core's shared
 *               inbox, D22) and the proposer's own decision on one of them, forwarded to Core's canonical decision owner. */
export const MEMORY_PATHS=Object.freeze({
 list:'/api/memory/proposals/list',status:'/api/memory/proposals/status',propose:'/api/memory/proposals/propose',correct:'/api/memory/proposals/correct',
 reviewList:'/api/memory/review/list',reviewApprove:'/api/memory/review/approve',reviewReject:'/api/memory/review/reject'});
/** Transport ceilings for the memory mount; the control's own limits can only lower them. A listing page carries at most 50
 * candidates of 4000 characters with 16 sources each (under 1 MiB); a proposal body is a few KiB. */
export const MEMORY_LIMITS=Object.freeze({maxRequestMs:30000,maxRequestBytes:65536,maxResponseBytes:1048576});
/** The fixed mount's answer while no memory application is composed (disabled, unconfigured or missing its owners). */
export const memoryUnavailable=()=>Response.json({error:{code:'MEMORY_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
