/** ONE host-owned signed-definition snapshot owner shared by every upload child.
 *
 * The existing `createSignedDefinitionStore` remains the only reader/signature/prune owner; this module adds the host-level
 * PIN accounting it cannot provide per child: an acquired snapshot is held until the ACTUAL child closure releases it, a
 * prune is never requested while any pin is held, and a release that cannot be proven stays retained (unknown), so no
 * guessed completion can free another reader's snapshot. Nothing here refreshes, provisions or fetches: freshclam stays
 * in the existing host lifecycle outside the upload child's no-egress network.
 */
const fault=code=>Object.assign(new Error(code),{code});

export function createDefinitionSnapshotOwner({definitions,now=Date.now}={}){
 if(!definitions||typeof definitions.snapshot!=='function'||typeof definitions.prune!=='function'||typeof now!=='function')
  throw fault('UPLOAD_DEFINITIONS_CONFIGURATION');
 const pins=new Map();let sequence=0;
 return Object.freeze({
  /** Acquire and HOLD the exact immutable snapshot for one child. */
  async pin({deadlineMs,signal}={}){
   const snapshot=await definitions.snapshot({deadlineMs,signal});
   const id=`pin-${++sequence}`;
   let released=false;
   const entry={id,databaseDirectory:snapshot.databaseDirectory,sha256:snapshot.sha256,reader:snapshot.reader};
   pins.set(id,entry);
   return Object.freeze({id,databaseDirectory:entry.databaseDirectory,sha256:entry.sha256,
    /** Release only at actual child closure. A failed/unknown release keeps the pin and reports it. */
    release({completed=false}={}){
     if(released)return Object.freeze({released:true,already:true});
     let value;
     try{value=entry.reader?.release?.({completed})===true;}catch{return Object.freeze({released:false,code:'UPLOAD_DEFINITIONS_RELEASE_UNKNOWN'});}
     if(value!==true)return Object.freeze({released:false,code:'UPLOAD_DEFINITIONS_RELEASE_UNKNOWN'});
     released=true;pins.delete(id);
     return Object.freeze({released:true});
    }});
  },
  active(){return pins.size;},
  /** Prune ONLY when this owner holds no pin; otherwise the shared snapshot is still in use. */
  async pruneIfIdle({signal,deadlineMs}={}){
   if(pins.size>0)return Object.freeze({skipped:true,reason:'ACTIVE_PINS',active:pins.size});
   return definitions.prune({signal,deadlineMs});
  }
 });
}
