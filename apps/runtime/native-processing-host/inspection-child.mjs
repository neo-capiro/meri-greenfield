/** The UID1000 inspection child: one fixed image-pinned operation over the finite placement.
 *
 * It composes the EXISTING upload owners — `composeUploadNativeHost` (qualifier + tools + signed definitions) and the fixed
 * scanner/extractor ports — and gives them the processing placement runner as their ONLY process port, so the qualifier,
 * scan and extract descendants inherit the same finite leaf and closed network. No command, argv, cwd, environment or
 * program is accepted from the request; the image declaration and fixed paths come from validated host configuration. */
import {composeUploadNativeHost} from '../uploads/composition.mjs';
import {createProcessingUploadRunner} from '../uploads/native-processing.mjs';
import {uploadFault} from '../uploads/native-sandbox.mjs';

export async function runFixedInspection({placement,config,deadlineMs,signal,bytes,file,now=Date.now}){
 if(!placement||typeof placement.run!=='function'||typeof placement.launcher!=='function')throw uploadFault('NATIVE_PROCESSING_PLACEMENT');
 if(!Buffer.isBuffer(bytes)||bytes.length<1)throw uploadFault('UPLOAD_ORIGINAL_MISMATCH');
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())throw uploadFault('UPLOAD_EXPIRED');
 const run=createProcessingUploadRunner({launcher:placement.launcher});
 const host=await composeUploadNativeHost({configuration:{uploads:{native:{enabled:true,imageDigest:config.image.digest,
   definitionsRoot:config.paths.definitionsRoot,extractorPath:config.paths.extractorPath}}},
  run,tempRoot:config.paths.scratchRoot,deadlineMs,signal,now,
  credentialPaths:config.paths.credentialPaths});
 if(host.scanner===null||host.extractor===null)throw uploadFault('NATIVE_PROCESSING_UNAVAILABLE');
 const scan=await host.scanner.scan({file,bytes,deadlineMs,signal});
 if(scan.status!=='clean'&&scan.status!=='infected'&&scan.status!=='unavailable')throw uploadFault('NATIVE_PROCESSING_RESULT');
 if(file?.format===undefined)return Object.freeze({scan,extract:null});
 const extract=await host.extractor.extract({file,bytes,deadlineMs,signal});
 return Object.freeze({scan,extract});
}
