# Current application authority adapters

`authority-http.mjs` is the bounded Core identity/context transport. `current-receipt.mjs` validates Core current-authority receipts. `context-adapter.mjs` combines current Core identity/context with the existing Meri binding owner for session issuance.

Runtime control, native authority and read-context consumers use these modules. Core supplies tenant/member/client/wall access; Meri supplies its canonical binding and run state. Browser selectors confer no authority. Calls preserve their original deadline, validate current principal and revision correlation, and release no credentials.

The former allocation/grant action-host mounting seam has been removed. Current standalone actions use the runtime task family and the native task receiver.
