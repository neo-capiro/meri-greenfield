# Static recheck at b2c7f542

Source reviewed: `b2c7f5421f75553bd2761a4d5d34a8fbd30b5b13`. No SDK/DB probe or provider call executed by reviewer.

Supported config routing resolves the earlier ambient-home concern: the probe sets CLAUDE_CONFIG_DIR and CLAUDE_SECURESTORAGE_CONFIG_DIR in its own process before SDK import, supplies the same paths to its child, and supplies task-owned XDG locations. Installed SDK global config resolver _Q explicitly chooses CLAUDE_CONFIG_DIR before home; Wq scopes secure storage using CLAUDE_SECURESTORAGE_CONFIG_DIR or CLAUDE_CONFIG_DIR. The earlier recommendation to repurpose HOME conflicted with the developer environment rule and is withdrawn. HOME remains unchanged. This is configuration containment, not physical isolation proof.

The repair now refuses success without observed child closure and complete/error-free first stdout observer facts; it marks forced SIGKILL as failed witness, waits a bounded interval, and retains temporary state if closure remains unknown. Existing enclosing child-subreaper process-group cleanup remains required. Production source/schema/dependencies are unchanged.

One remaining witness-accuracy concern: the second JSON-parsing Transform catches frame-bound/JSON errors but does not record its own error flag. The success gate examines only the first observer's EOF/close/error facts; an early valid init/mirror followed by parser failure could be reported as success if the first observer completed normally. queryFailed is separately reported and may reflect the intentionally refusing local sink, so it cannot distinguish parser corruption. Record and gate a nativeFrameError flag on second Transform failures and reject/flag nonempty unfinished trailing JSON at EOF before accepting the mechanical witness. No actual native authority is supplied regardless.

Decision: prior config-routing and force-close/first-stream holds resolved; final local SDK witness remains HOLD pending explicit second-parser error/tail gate. Database refusal remains within separately admitted read-only fixture scope; its execution result belongs to the parent.
