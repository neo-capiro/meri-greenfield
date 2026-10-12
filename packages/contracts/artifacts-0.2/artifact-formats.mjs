// One content-format vocabulary shared by validation and publication metadata.
export const ARTIFACT_MIME_TYPES=Object.freeze({docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',pdf:'application/pdf',zip:'application/zip'});
export const artifactFilename=request=>(request.title.replace(/[^A-Za-z0-9._ -]/g,'_').replace(/^\.+/,'').trim().slice(0,120)||'artifact')+'.'+request.format;
