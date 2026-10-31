export interface NativeObserver {
 readonly schema:'meri-native-managed-observer/1';
 readonly protocol:'native-observer-around-managed/1';
 readonly bridgeFunctionVersionArn:string;
 readonly route:'/v1/execution/native/physical-observer';
 readonly authenticationPrincipal:'native-watchdog-observer-v1';
}
export const NATIVE_OBSERVER_PROTOCOL:'native-observer-around-managed/1';
export const NATIVE_OBSERVER_ROUTE:'/v1/execution/native/physical-observer';
export const NATIVE_OBSERVER_TAG_POLICY:'instance-and-root-volume-owner-tags/1';
export const NATIVE_DECLARATION_V2:'meri-native-provisioning-declaration/2';
export function nativeObserverDeadline(start:number,duration?:number):number;
export function assertNativeObserver(value:unknown,scope?:{accountId?:string;region?:string}):NativeObserver;
export function assertNativeObserverPlacement(placement:unknown,launch:unknown):Readonly<{placement:Readonly<Record<string,unknown>>;launch:Readonly<Record<string,unknown>>}>;
export function assertNativeObserverInput(value:unknown):Readonly<Record<string,unknown>>;
export function nativeObserverLaunchTags(value:{allocation:Record<string,unknown>;declaration:Record<string,unknown>}):Readonly<Record<string,string>>;
export function nativeObserverLaunchRequest(value:{allocation:Record<string,unknown>;declaration:Record<string,unknown>}):Readonly<Record<string,unknown>>;
export function assertNativeRetainedPhysical(value:unknown,expected:{allocation:unknown;binding:unknown;declaration:Record<string,any>;nowMs:number}):Readonly<Record<string,any>>;
