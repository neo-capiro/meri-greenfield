/** Single-bind relay for the native allocation reader used by the uploads-native mount.
 *
 * startControl mounts uploads-native before assembleControl creates the canonical session/store/retention owners.
 * The mount resolves ONE target per operation, so it may be constructed with this relay and bound to the REAL
 * createPostgresNativeAllocationReader once those owners exist — before any listener accepts upload requests.
 * A call before binding, or a second bind, refuses; close() unbinds so a partially initialized startup cannot
 * leave a live reader bound to torn-down owners. This is not a durable owner and stores nothing.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function createNativeAllocationRelay({refuse='NATIVE_HOST_ALLOCATION_UNAVAILABLE'}={}){
 let reader=null,closed=false;
 const port=Object.freeze({
  resolve(value){if(closed||reader===null)fail(refuse);return reader.resolve(value);},
  ready(value){if(closed||reader===null||typeof reader.ready!=='function')fail(refuse);return reader.ready(value);},
  bind(next){
   if(closed||reader!==null)fail('NATIVE_HOST_ALLOCATION_BINDING');
   if(next===null||typeof next?.resolve!=='function')fail('NATIVE_HOST_ALLOCATION_BINDING');
   reader=next;return port;},
  close(){if(closed)return Object.freeze({closed:true});closed=true;reader=null;return Object.freeze({closed:true});},
 });
 return port;
}
